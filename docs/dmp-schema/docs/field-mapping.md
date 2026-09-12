# Field mapping: top-level `dmp` object -> RDA-DMP-Common Standard v1.2

Schema definition: `$defs/DMPData` in schema/maDMP-schema-1.2.json.
Root document shape: `{ "dmp": DMPData }`.

Required fields (schema `required` list on DMPData):
contact, created, dataset, dmp_id, ethical_issues_exist, language, modified, title

| Field                       | Required | Type / $ref                    | Notes |
|------------------------------|----------|---------------------------------|-------|
| title                        | yes      | string                          | Title of the DMP |
| description                  | no       | string                          | Free text, project overview |
| language                     | yes      | $defs/LanguageCode (ISO 639-3)  | e.g. "eng" |
| created                      | yes      | string, format: date-time       | ISO 8601 with timezone; must not change across versions |
| modified                     | yes      | string, format: date-time       | ISO 8601 with timezone; bump every edit |
| dmp_id                       | yes      | $defs/DMPID                     | { identifier, type }; type suggested: handle/doi/ark/url |
| ethical_issues_exist         | yes      | $defs/Booleanish (yes/no/unknown) | Enum, not a JSON boolean |
| ethical_issues_description   | no       | string                          | |
| ethical_issues_report        | no       | string (URL)                    | |
| contact                      | yes      | $defs/Contact                   | { name, mbox, contact_id, affiliation[] } |
| contributor                  | no       | $defs/Contributors (array)      | Each has name, mbox, contributor_id, role[] |
| cost                         | no       | $defs/Costs (array)             | { title, description, currency_code, value, value_type } |
| dataset                      | yes      | $defs/Datasets (array)          | See Dataset table below; required even if empty is NOT allowed per schema (minItems not set but field itself is required) |
| project                      | no       | $defs/Project (array)           | { title, description, start, end, funding[], project_id[] } |
| alternate_identifier         | no       | $defs/AlternateIdentifier[]     | |
| related_identifier           | no       | $defs/RelatedIdentifier[]       | |
| additional_properties        | n/a      | schema permits vendor extension fields per spec note, but this JSON Schema itself does not set additionalProperties:false at the DMPData level — verify before relying on strict rejection of unknown keys |

## Dataset ($defs/Dataset) — required: dataset_id, personal_data, sensitive_data, title

| Field | Notes |
|---|---|
| dataset_id | { identifier, type } — suggested handle/doi/ark/url |
| title | string |
| description | string |
| type | free text or DataCite/COAR vocab |
| personal_data | Booleanish enum |
| sensitive_data | Booleanish enum |
| language | LanguageCode |
| keyword[] | string[] |
| issued | date |
| metadata[] | $defs/Metadata |
| security_and_privacy | $defs/SecurityAndPrivacyItems |
| technical_resource | $defs/TechnicalResources |
| preservation_statement | string |
| data_quality_assurance | string |
| distribution[] | $defs/Distribution (see below) |

## Distribution — required: data_access, title

| Field | Notes |
|---|---|
| title, description | strings |
| access_url, download_url | URLs |
| available_until | date |
| byte_size | integer |
| data_access | enum: open / shared / closed |
| format[] | strings (MIME types) |
| license[] | { license_name?, license_ref, start_date } |
| host | $defs/Host (re3data-backed) |

## Contact / Contributor common shape

| Field | Notes |
|---|---|
| name | string |
| mbox | email string |
| contact_id / contributor_id | { identifier, type } — suggested orcid/isni/openid/other |
| affiliation[] | $defs/Affiliation: { affiliation_id, name } |
| role[] (contributor only) | e.g. ProjectLeader, DataManager, DataCurator, ContactPerson |

## Project ($defs/Project)

| Field | Notes |
|---|---|
| title, description | strings |
| start, end | date |
| project_id[] | { identifier, type } |
| funding[] | $defs/Funding: { funder_id, funding_status, grant_id } |

## Cost ($defs/Cost)

| Field | Notes |
|---|---|
| title | string |
| description | string |
| currency_code | ISO 4217, e.g. "EUR" |
| value | number |
| value_type | e.g. investment/charge/salary |

## Shared enums

- Booleanish: yes / no / unknown — used for ethical_issues_exist, personal_data, sensitive_data
- data_access: open / shared / closed
- Certification: din31644, dini-zertifikat, dsa, iso16363, iso16919, trac, wds, coretrustseal

## References

- Standard repo: https://github.com/RDA-DMP-Common/RDA-DMP-Common-Standard
- Schema source: examples/JSON/JSON-schema/1.2/maDMP-schema-1.2.json
- Example docs: examples/JSON/ex1..ex10 (mirrored under fixtures/valid/)
