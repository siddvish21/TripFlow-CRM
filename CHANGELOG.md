
# Changelog

## [1.1.0] - Payment Ledger & Image Assets Update

### Added
- **Payment Ledger Tab**: A new section within the "Payment" tab to record individual transactions (Received, Paid, Flights, Refunds).
- **Transaction History**: Payments are now stored as structured records with dates, modes (UPI/Bank/Cash), and notes.
- **Auto-Calculation**: The Payment Summary text generator now automatically calculates "Amounts Received" and "Transfers" from the Ledger entries.
- **Local Assets**: Added `assets/localImages.ts` to store banner images as Base64 strings directly in the codebase, ensuring consistent branding in offline scenarios.

### Changed
- **Quotation Autofill**: The "Amount Received" field in the Quotation Generator now pulls directly from the Payment Ledger's "Received" transactions.
- **Image Service**: Updated `services/imageService.ts` to use local assets instead of external URLs.
- **Google Drive Service**: Improved initialization logic to prevent null auth instance errors.

### Fixed
- Fixed an issue where the Google Auth instance could be null on page load.
- Fixed dependency issues with image fetching.

### How to Use
1.  **Payment Ledger**: Go to the "Payment" tab. Use the "Payment Ledger" form at the top to add payments received from clients or paid to vendors.
2.  **Summary Generation**: Click "Generate Summary" to see the updated text based on your ledger entries.
3.  **Quotation**: When you generate a new quote, if you have recorded payments in the ledger, the "Amount Received" field will be pre-filled.
4.  **Images**: Open `assets/localImages.ts` and replace the placeholder Base64 strings with your actual banner image data.
