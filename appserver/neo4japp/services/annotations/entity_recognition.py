import json

from dataclasses import dataclass
from typing import Dict, List, Optional

from .constants import (
    EntityType,
    ANATOMY_LMDB,
    CHEMICALS_LMDB,
    COMPOUNDS_LMDB,
    DISEASES_LMDB,
    FOODS_LMDB,
    GENES_LMDB,
    PHENOMENAS_LMDB,
    PHENOTYPES_LMDB,
    PROTEINS_LMDB,
    SPECIES_LMDB,
    MAX_GENE_WORD_LENGTH,
    MAX_FOOD_WORD_LENGTH
)
from .data_transfer_objects import (
    RecognizedEntities,
    LMDBMatch,
    NLPResults,
    PDFWord,
    GlobalExclusions,
    GlobalInclusions
)
from .lmdb_service import LMDBService


@dataclass(frozen=True)
class LMDBEntityConfig:
    entity_type: str
    dbname: str
    result_field: str
    inclusion_attr: str
    exclusion_attr: str
    exclusion_ci_attr: Optional[str] = None
    max_word_length: Optional[int] = None
    nlp_veto_attr: Optional[str] = None


_LMDB_ENTITY_CONFIGS: List[LMDBEntityConfig] = [
    LMDBEntityConfig(
        entity_type=EntityType.ANATOMY.value,
        dbname=ANATOMY_LMDB,
        result_field='recognized_anatomy',
        inclusion_attr='included_anatomy',
        exclusion_attr='excluded_anatomy',
    ),
    LMDBEntityConfig(
        entity_type=EntityType.CHEMICAL.value,
        dbname=CHEMICALS_LMDB,
        result_field='recognized_chemicals',
        inclusion_attr='included_chemicals',
        exclusion_attr='excluded_chemicals',
        nlp_veto_attr='chemicals',
    ),
    LMDBEntityConfig(
        entity_type=EntityType.COMPOUND.value,
        dbname=COMPOUNDS_LMDB,
        result_field='recognized_compounds',
        inclusion_attr='included_compounds',
        exclusion_attr='excluded_compounds',
        nlp_veto_attr='compounds',
    ),
    LMDBEntityConfig(
        entity_type=EntityType.DISEASE.value,
        dbname=DISEASES_LMDB,
        result_field='recognized_diseases',
        inclusion_attr='included_diseases',
        exclusion_attr='excluded_diseases',
        nlp_veto_attr='diseases',
    ),
    LMDBEntityConfig(
        entity_type=EntityType.FOOD.value,
        dbname=FOODS_LMDB,
        result_field='recognized_foods',
        inclusion_attr='included_foods',
        exclusion_attr='excluded_foods',
        max_word_length=MAX_FOOD_WORD_LENGTH,
    ),
    LMDBEntityConfig(
        entity_type=EntityType.PHENOMENA.value,
        dbname=PHENOMENAS_LMDB,
        result_field='recognized_phenomenas',
        inclusion_attr='included_phenomenas',
        exclusion_attr='excluded_phenomenas',
    ),
    LMDBEntityConfig(
        entity_type=EntityType.PHENOTYPE.value,
        dbname=PHENOTYPES_LMDB,
        result_field='recognized_phenotypes',
        inclusion_attr='included_phenotypes',
        exclusion_attr='excluded_phenotypes',
    ),
    LMDBEntityConfig(
        entity_type=EntityType.PROTEIN.value,
        dbname=PROTEINS_LMDB,
        result_field='recognized_proteins',
        inclusion_attr='included_proteins',
        exclusion_attr='excluded_proteins',
        exclusion_ci_attr='excluded_proteins_case_insensitive',
    ),
]


class EntityRecognitionService:
    def __init__(
        self,
        exclusions: GlobalExclusions,
        inclusions: GlobalInclusions,
        lmdb: LMDBService
    ):
        self.lmdb = lmdb
        self.entity_exclusions = exclusions
        self.entity_inclusions = inclusions

    def _check_lmdb_genes(self, nlp_results: NLPResults, tokens: List[PDFWord]):
        keys = {token.normalized_keyword for token in tokens}

        global_inclusion = self.entity_inclusions.included_genes
        global_exclusion = self.entity_exclusions.excluded_genes
        global_exclusion_case_insensitive = self.entity_exclusions.excluded_genes_case_insensitive

        key_results = self._query_lmdb_raw(GENES_LMDB, keys)

        # gene is a bit different
        # we want both from lmdb and inclusions
        # not only check inclusions for keys not in lmdb
        # because a global could normalize to something already in
        # LMDB, e.g IL-8 is a global inclusion, but il8 is already
        # normalized in LMDB from IL8
        for key in keys:
            found = global_inclusion.get(key, None)
            if found:
                match_list = key_results.get(key, [])
                match_list += found
                key_results[key] = match_list

        lmdb_matches = []
        for token in tokens:
            if token.normalized_keyword in key_results:
                lowered = token.keyword.lower()
                if token.keyword in global_exclusion or lowered in global_exclusion_case_insensitive:  # noqa
                    continue

                exact = [data for data in key_results[token.normalized_keyword] if data['synonym'] == token.keyword]  # noqa
                if not exact:
                    continue

                match = LMDBMatch(
                    entities=[data for data in exact if data['synonym'] == data['name']] or exact,
                    token=token
                )
                offset_key = (token.lo_location_offset, token.hi_location_offset)
                # if an entity set in nlp_results is not empty
                # that means NLP was used
                # NLP is veto, so if not found it vetos
                if nlp_results.genes:
                    if offset_key in nlp_results.genes:
                        lmdb_matches.append(match)
                else:
                    lmdb_matches.append(match)
        return lmdb_matches

    def _check_lmdb_species(self, tokens: List[PDFWord]):
        keys = {token.normalized_keyword for token in tokens}

        global_inclusion = self.entity_inclusions.included_species
        local_inclusion = self.entity_inclusions.included_local_species
        global_exclusion = self.entity_exclusions.excluded_species

        key_results = self._query_lmdb_raw(SPECIES_LMDB, keys)
        key_results_local: Dict[str, List[dict]] = {}

        unmatched_keys = keys - set(key_results)

        # for species, check both global and local inclusions
        for key in unmatched_keys:
            found = global_inclusion.get(key, None)
            if found:
                key_results[key] = found

        unmatched_keys = keys - set(key_results)

        for key in unmatched_keys:
            found = local_inclusion.get(key, None)
            if found:
                key_results_local[key] = found

        lmdb_matches = []
        lmdb_matches_local = []
        for token in tokens:
            if token.keyword.lower() not in global_exclusion:
                if token.normalized_keyword in key_results:
                    lmdb_matches.append(
                        LMDBMatch(
                            entities=[
                                data for data in key_results[token.normalized_keyword] if data['synonym'] == data['name']  # noqa
                            ] or key_results[token.normalized_keyword],
                            token=token
                        )
                    )
                elif token.normalized_keyword in key_results_local:
                    lmdb_matches_local.append(
                        LMDBMatch(
                            entities=[
                                data for data in key_results_local[token.normalized_keyword] if data['synonym'] == data['name']  # noqa
                            ] or key_results_local[token.normalized_keyword],
                            token=token
                        )
                    )
        return lmdb_matches, lmdb_matches_local

    def _query_lmdb_raw(self, dbname: str, keys: set) -> Dict[str, List[dict]]:
        key_results: Dict[str, List[dict]] = {}
        with self.lmdb.begin(dbname=dbname) as txn:
            cursor = txn.cursor()
            for key, value in cursor.getmulti([k.encode('utf-8') for k in keys], dupdata=True):
                decoded_key = key.decode('utf-8')
                match_list = key_results.get(decoded_key, [])
                match_list.append(json.loads(value))
                key_results[decoded_key] = match_list
        return key_results

    def _match_from_inclusions(
        self,
        tokens: List[PDFWord],
        inclusion: dict,
        exclusion: set,
    ) -> List[LMDBMatch]:
        return [
            LMDBMatch(entities=inclusion[token.normalized_keyword], token=token)
            for token in tokens
            if inclusion.get(token.normalized_keyword) and token.keyword.lower() not in exclusion
        ]

    def _is_token_excluded(
        self,
        token: PDFWord,
        exclusion: set,
        exclusion_ci: Optional[set],
    ) -> bool:
        lowered = token.keyword.lower()
        if exclusion_ci:
            return token.keyword in exclusion or lowered in exclusion_ci
        return lowered in exclusion

    def _check_lmdb_standard(
        self,
        config: LMDBEntityConfig,
        tokens: List[PDFWord],
        nlp_results: NLPResults,
    ) -> List[LMDBMatch]:
        if config.max_word_length is not None:
            tokens_to_check = [
                t for t in tokens if len(t.keyword.split(' ')) <= config.max_word_length
            ]
        else:
            tokens_to_check = tokens
        keys = {t.normalized_keyword for t in tokens_to_check}

        inclusion = getattr(self.entity_inclusions, config.inclusion_attr)
        exclusion = getattr(self.entity_exclusions, config.exclusion_attr)
        exclusion_ci = (
            getattr(self.entity_exclusions, config.exclusion_ci_attr)
            if config.exclusion_ci_attr else None
        )

        key_results = self._query_lmdb_raw(config.dbname, keys)

        for key in keys - set(key_results):
            found = inclusion.get(key)
            if found:
                key_results[key] = found

        nlp_veto_set = getattr(nlp_results, config.nlp_veto_attr) if config.nlp_veto_attr else set()

        lmdb_matches = []
        for token in tokens_to_check:
            if token.normalized_keyword not in key_results:
                continue

            if self._is_token_excluded(token, exclusion, exclusion_ci):
                continue

            match = LMDBMatch(
                entities=[
                    data for data in key_results[token.normalized_keyword]
                    if data['synonym'] == data['name']
                ] or key_results[token.normalized_keyword],
                token=token
            )

            if nlp_veto_set:
                offset_key = (token.lo_location_offset, token.hi_location_offset)
                if offset_key in nlp_veto_set:
                    lmdb_matches.append(match)
            else:
                lmdb_matches.append(match)

        return lmdb_matches

    def check_lmdb(self, nlp_results: NLPResults, tokens: List[PDFWord]):
        results = RecognizedEntities()

        gene_tokens = [t for t in tokens if len(t.keyword.split(' ')) <= MAX_GENE_WORD_LENGTH]
        results.recognized_genes = self._check_lmdb_genes(nlp_results, gene_tokens)

        recognized_species, recognized_local_species = self._check_lmdb_species(tokens)
        results.recognized_species = recognized_species
        results.recognized_local_species = recognized_local_species

        inc = self.entity_inclusions
        exc = self.entity_exclusions
        results.recognized_companies = self._match_from_inclusions(
            tokens, inc.included_companies, exc.excluded_companies)
        results.recognized_entities = self._match_from_inclusions(
            tokens, inc.included_entities, exc.excluded_entities)
        results.recognized_lab_samples = self._match_from_inclusions(
            tokens, inc.included_lab_samples, exc.excluded_lab_samples)
        results.recognized_lab_strains = self._match_from_inclusions(
            tokens, inc.included_lab_strains, exc.excluded_lab_strains)

        for config in _LMDB_ENTITY_CONFIGS:
            matches = self._check_lmdb_standard(config, tokens, nlp_results)
            setattr(results, config.result_field, matches)

        return results

    def identify(self, tokens: List[PDFWord], nlp_results: NLPResults) -> RecognizedEntities:
        return self.check_lmdb(nlp_results=nlp_results, tokens=tokens)
