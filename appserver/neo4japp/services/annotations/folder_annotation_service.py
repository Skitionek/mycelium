"""Folder-level annotation configuration service.

Reads `.annotations` JSON files from the ancestor folder chain of a given
file and merges them into a single :class:`EffectiveAnnotationConfig`.

When the ``file_effective_annotation_config`` table is populated (updated via
``refresh_effective_annotation_subtree`` called by
:class:`AnnotationsFileTypeProvider`), the service queries it directly for
O(1) lookup.  Otherwise it falls back to walking the ancestor chain.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from neo4japp.constants import FILE_MIME_TYPE_ANNOTATIONS
from neo4japp.database import db
from neo4japp.models.files import Files

ANNOTATIONS_FILENAME = '.annotations'


@dataclass
class EffectiveAnnotationConfig:
    """Merged annotation configuration resolved from folder-level .annotations files
    combined with any per-file overrides.
    """
    annotation_configs: Optional[Dict[str, Any]] = None
    fallback_organism: Optional[Dict[str, str]] = None
    custom_annotations: List[dict] = field(default_factory=list)
    excluded_annotations: List[dict] = field(default_factory=list)


def _lookup_annotations_config(folder_id: int) -> Optional[dict]:
    """Return the parsed config for the .annotations file inside *folder_id*,
    or ``None`` if no such file exists.

    The .annotations file content is stored as UTF-8 JSON in files_content.
    """
    import json
    from neo4japp.models.files import FileContent

    row = (
        db.session.query(Files.content_id, Files.hash_id)
        .filter(
            Files.filename == ANNOTATIONS_FILENAME,
            Files.parent_id == folder_id,
            Files.mime_type == FILE_MIME_TYPE_ANNOTATIONS,
            Files.deletion_date.is_(None),
            Files.content_id.isnot(None),
        )
        .one_or_none()
    )
    if row is None:
        return None

    fc = (
        db.session.query(FileContent)
        .filter(FileContent.id == row.content_id)
        .one_or_none()
    )
    if fc is None:
        return None
    raw = fc.get_bytes(path=row.hash_id)
    if not raw:
        return None

    try:
        data = json.loads(raw.decode('utf-8'))
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def _merge_layer(base: EffectiveAnnotationConfig, layer: dict) -> EffectiveAnnotationConfig:
    """Merge one .annotations layer on top of *base*.

    Rules:
    - ``annotation_configs`` is deep-merged (inner overrides outer per entity type).
    - ``fallback_organism`` replaces the outer value if present.
    - ``include`` / ``exclude`` lists are *accumulated* (inner appended after outer).
    """
    result = EffectiveAnnotationConfig(
        annotation_configs=dict(base.annotation_configs) if base.annotation_configs else None,
        fallback_organism=base.fallback_organism,
        custom_annotations=list(base.custom_annotations),
        excluded_annotations=list(base.excluded_annotations),
    )

    # fallback_organism
    if layer.get('fallback_organism'):
        result.fallback_organism = layer['fallback_organism']

    # annotation_configs
    layer_annotation_configs = layer.get('annotation_configs')
    if layer_annotation_configs:
        merged = dict(result.annotation_configs or {})
        layer_methods = layer_annotation_configs.get('annotation_methods', {})
        if layer_methods:
            existing_methods = dict(merged.get('annotation_methods', {}))
            existing_methods.update(layer_methods)
            merged['annotation_methods'] = existing_methods
        if 'exclude_references' in layer_annotation_configs:
            merged['exclude_references'] = layer_annotation_configs['exclude_references']
        result.annotation_configs = merged if merged else None

    # include / custom_annotations
    for inc in layer.get('include', []):
        result.custom_annotations.append(inc)

    # exclude / excluded_annotations
    for exc in layer.get('exclude', []):
        result.excluded_annotations.append(exc)

    return result


class FolderAnnotationService:
    """Resolves effective annotation configuration for a file or directory.

    Primary path: queries the ``file_effective_annotation_config`` table (a
    single indexed lookup populated by BFS when .annotations files change).
    Falls back to walking the ancestor chain and reading
    ``files_content.raw_file`` (stored as JSON) if the row is not yet in the
    table.
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_effective_annotation_config(
        self,
        file: Files,
        *,
        per_file_custom_annotations: Optional[List[dict]] = None,
        per_file_excluded_annotations: Optional[List[dict]] = None,
        per_file_annotation_configs: Optional[Dict[str, Any]] = None,
        per_file_organism: Any = None,
    ) -> EffectiveAnnotationConfig:
        """Return the effective annotation config for *file*.

        Tries the materialized view first, then falls back to the ancestor
        chain walk.  Per-file values are applied as the innermost layer on top
        of the folder-derived config for backward compatibility.

        :param file: the target file whose effective config should be resolved
        :param per_file_custom_annotations: per-file custom inclusions
        :param per_file_excluded_annotations: per-file exclusions
        :param per_file_annotation_configs: per-file annotation_configs
        :param per_file_organism: per-file FallbackOrganism object
        :return: merged :class:`EffectiveAnnotationConfig`
        """
        effective = self._get_from_view(file) or self._get_from_chain(file)

        # Apply per-file overrides as the innermost layer
        per_file_layer: dict = {}
        if per_file_annotation_configs:
            per_file_layer['annotation_configs'] = per_file_annotation_configs
        if per_file_organism:
            per_file_layer['fallback_organism'] = {
                'synonym': per_file_organism.organism_synonym,
                'taxonomy_id': per_file_organism.organism_taxonomy_id,
            }
        if per_file_custom_annotations:
            per_file_layer['include'] = per_file_custom_annotations
        if per_file_excluded_annotations:
            per_file_layer['exclude'] = per_file_excluded_annotations

        if per_file_layer:
            effective = _merge_layer(effective, per_file_layer)

        return effective

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _get_from_view(self, file: Files) -> Optional[EffectiveAnnotationConfig]:
        """Query the file_effective_annotation_config table for a pre-computed config."""
        from sqlalchemy import text
        try:
            row = db.session.execute(
                text(
                    'SELECT effective_annotation_configs,'
                    '       effective_fallback_organism,'
                    '       effective_custom_annotations,'
                    '       effective_excluded_annotations'
                    ' FROM file_effective_annotation_config'
                    ' WHERE hash_id = :hash_id'
                ),
                {'hash_id': file.hash_id},
            ).fetchone()
        except Exception:
            return None

        if row is None:
            return None

        return EffectiveAnnotationConfig(
            annotation_configs=row[0] if row[0] else None,
            fallback_organism=row[1],
            custom_annotations=list(row[2] or []),
            excluded_annotations=list(row[3] or []),
        )

    def _get_from_chain(self, file: Files) -> EffectiveAnnotationConfig:
        """Walk the ancestor folder chain and merge .annotations configs."""
        ancestors: List[Files] = []
        try:
            path = file.file_path  # [root, ..., file]
            ancestors = path[:-1]  # exclude the file itself
        except Exception:
            ancestors = []

        layers: List[dict] = []
        for ancestor in ancestors:
            layer = _lookup_annotations_config(ancestor.id)
            if not layer:
                continue
            if not layer.get('inherit', True):
                layers = []
            layers.append(layer)

        effective = EffectiveAnnotationConfig()
        for layer in layers:
            effective = _merge_layer(effective, layer)
        return effective



