# Statement imports

## Purpose
Convert institution-specific statement data into a consistent financial model. The pilot implements the Mercado Pago account-PDF parser/mapper and the shared financial contract. The initial schema has been applied by the user.

## Responsibilities
- Each institution owns its mapper. Different file formats or statement products may have separate parsers within that institution.
- Parsers extract source records and layout details. Institution mappers interpret those records and produce the shared import contract.
- The import service validates normalized records, reconciles totals, identifies duplicate candidates, and prepares review. Financial categorization and persistence stay outside parsers and mappers.
- Repositories persist reviewed records. UI components present previews and corrections; they do not interpret bank descriptions.
- Add concrete modules for supported institutions only. Do not introduce a plugin framework or universal bank parser.

## Semantic model and naming
Use English financial terms in application contracts and snake_case database columns. Transport resources are declared in core integration DTOs and generated from OpenAPI for the frontend; examples below describe semantics.

| Concept | Example field | Meaning |
| --- | --- | --- |
| Financial account | `account_id` | Account owned by the authenticated user |
| Institution | `institution` | Source institution, such as Mercado Pago; separate from card brand |
| Source operation reference | `source_operation_id` | Institution-provided reference; not assumed unique per transaction |
| Transaction date | `transaction_date` | Financial event date; retain date-only precision when no time is supplied |
| Posting date | `posting_date` | Booking date, only when separately provided |
| Amount and currency | `amount`, `currency` | Exact money values; use integer minor units for initial BRL support |
| Direction | `direction` | Money entering or leaving the tracked account; does not determine income or expense by itself |
| Financial classification | `transaction_type` | Income, expense, transfer, or unresolved pending review |
| Description | `description` | Human-readable transaction description |
| Merchant | `merchant` | Merchant for a purchase, when identifiable |
| Counterparty | `counterparty` | Other party to a financial movement; not automatically a merchant |
| Card brand | `brand` | Card network, such as Visa or Mastercard, within card/payment context |
| Installment count | `installments` | Total number of installments, when known |
| Current installment | `installment_number` | Current installment's ordinal number, when known |
| Statement balance | `balance_after` | Source account balance after the movement, when supplied |

## Rules
- Unknown brand, merchant, installment information, time, or classification stays absent or explicitly unresolved. Do not invent values to fill the contract.
- Validate positive installment counts and ordinals; the current ordinal cannot exceed a known total. Do not assume an unknown count means a single payment.
- Preserve enough provenance to trace a normalized entry to its institution, source account, import batch, and source record. Do not store original PDFs by default.
- Internal transfers and reserved-money movements must not automatically become income or expense solely because their amounts are positive or negative.
- Duplicate checks are scoped to the owner, source account, and institution. A source operation ID alone is insufficient; review ambiguous candidates using additional transaction attributes.
- Detect an already imported source file separately from overlapping statements. Preserve multiple legitimate movements sharing an operation reference.
- Treat summaries as reconciliation inputs, not additional transactions. Reconstruct descriptions split across PDF lines and exclude repeated page headings/footers.
- Reject unsupported layouts clearly. Validate additional representative samples before claiming broad bank or format support.

## Mercado Pago sample findings
The user-provided PDF was inspected locally without adding it or extracted personal data to the repository.

- Institution confirmed as Mercado Pago; statement contains extractable text across 24 pages, so this sample does not require OCR.
- Columns: date, description, operation ID, amount, and running balance; descriptions can span multiple lines.
- Extracted 315 movements using a temporary layout inspection. All amounts parsed, every running balance reconciled, and opening balance plus movements matched the closing balance.
- Found 65 reserved-money movements and 18 yield entries; reserve movements need explicit transfer interpretation and review.
- Two operation references each occur on two distinct rows with different amounts and balances. Never enforce uniqueness on source operation ID alone.
- Inspection validates feasibility for this sample, not a production importer or coverage of other statement versions.

## Risks
Layout changes, incorrect line grouping, false duplicate removal, confusing transfers with expenses, and treating missing payment metadata as known.

## Implemented review behavior
PDF extraction runs in a bounded worker outside database transactions, with one concurrent extraction per user in this API process. Source balance continuity is mandatory. Reserve movements map to transfers, positive yield entries to income, and other movements to unclassified. A user-invoked bulk classification proposes income/expense from signs while preserving recognized reserve transfers; the user must review own-account transfers before confirmation. Category, merchant, card brand, and installment data are not invented from this sample.

Confirmation rechecks account ownership and duplicates under an account lock, persists a receipt, and writes only selected classified items atomically. Exact repeat uploads return the existing draft/receipt; expired drafts can be replaced. Batch reversal refuses active entries with later edits and permits users to reverse those individual entries before reversing the rest of the batch. These paths have synthetic database tests; concurrent hosted confirmations remain a separate acceptance check.

Confirmation also compares the recorded account position before the first source date with the source opening balance. A mismatch is shown in review and blocks confirmation; an empty account's opening position can be corrected from Accounts. Existing financial history prevents silently rewriting that opening position.
