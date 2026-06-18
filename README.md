# Contractor Cash Flow Management App

A production-ready mobile application for managing contractor and laborer cash flow, bill verification, approvals, balances, and transaction history.

Built for real-world daily use by laborers, contractors, accountants, and company management — prioritizing simplicity, clarity, speed, and reliability over visual effects.

## Table of Contents

- [Project Goal](#project-goal)
- [Design Philosophy](#design-philosophy)
- [User Roles](#user-roles)
- [Authentication](#authentication)
- [Bill Upload Workflow](#bill-upload-workflow)
- [Approval Workflow](#approval-workflow)
- [Bill Statuses](#bill-statuses)
- [Rejection Workflow](#rejection-workflow)
- [Audit Trail](#audit-trail)
- [Financial Controls](#financial-controls)
- [Dashboards](#dashboards)
- [Reports](#reports)
- [Notifications](#notifications)
- [Security](#security)
- [Accessibility](#accessibility)
- [Database Schema](#database-schema)
- [Tech Stack](#tech-stack)
- [Future Features](#future-features)
- [Quality Standard](#quality-standard)

## Project Goal

Build a production-ready mobile application for managing contractor and laborer cash flow, bill verification, approvals, balances, and transaction history.

The target users are not highly technical and may have limited smartphone experience. The application must prioritize simplicity, clarity, speed, and reliability over visual effects.

## Design Philosophy

This is a real, production-quality mobile app interface — not a generic AI-generated design showcase.

**Avoid:**
- Floating gradient blobs, abstract 3D shapes, neon glows
- Oversized hero sections, stock photo placeholders
- Fake dashboard widgets, decorative glassmorphism
- Dribbble/Behance-style concept art
- Crypto/Web3 aesthetics, decorative clutter
- Marketing website layouts, empty placeholder content
- Futuristic visual effects

**Prioritize:**
- Clear information hierarchy
- Practical workflows
- Meaningful spacing and large tap targets
- Accessibility and readability
- Trustworthiness and fast task completion
- Minimal user confusion

The interface should feel like it was built by an experienced product team and used daily by real workers, using authentic mobile UX patterns from successful business applications.

## User Roles

### Super Admin (Company Head)

| Can | Cannot |
|---|---|
| View all contractors and laborers | — |
| Review contractor-approved bills | — |
| Approve or reject bills | — |
| Manage users | — |
| View reports, transaction history, audit logs | — |
| Monitor company-wide cash flow | — |

### Contractor

| Can | Cannot |
|---|---|
| View assigned laborers | View other contractors |
| Review laborer bills | View company-wide data |
| Approve or reject bills | — |
| View laborer balances and transaction history | — |

### Laborer

| Can | Cannot |
|---|---|
| Upload bills | Approve bills |
| View balance and bill history | Edit submitted bills |
| Track bill status | — |

## Authentication

Each user receives a User ID, username, password, and role.

**ID format examples:** `ADM0001`, `CTR0001`, `LAB0001`

- Passwords are generated automatically
- Passwords are securely hashed
- Plain text passwords are never stored

## Bill Upload Workflow

### Draft State

Before submission, the laborer may:
- Take, retake, or replace the photo
- Edit amount and notes

Nothing is saved permanently until submit.

### Submission

**Required fields:** Bill Photo, Amount
**Optional fields:** Notes

**Auto-generated:** Bill Number, Upload Timestamp, Server Timestamp

**Initial status:** `Pending Contractor Review`

## Approval Workflow

### Step 1 — Laborer Upload
Laborer submits bill → Status: `Pending Contractor Review`

### Step 2 — Contractor Review
Contractor reviews Bill Photo, Amount, Notes, and Upload Timestamp, then approves or rejects.

Stored on approval: Contractor ID, Contractor Approval Timestamp → Status: `Pending Admin Approval`

### Step 3 — Admin Review
Admin reviews Laborer Name, Contractor Name, Bill Photo, Amount, Upload Timestamp, and Contractor Approval Timestamp, then approves or rejects.

If approved:
- Create transaction
- Update balance
- Update cash flow
- Store Admin ID and Admin Approval Timestamp

Final status: `Approved`

## Bill Statuses

- `Draft`
- `Pending Contractor Review`
- `Pending Admin Approval`
- `Approved`
- `Rejected By Contractor`
- `Rejected By Admin`
- `Cancelled`

## Rejection Workflow

Rejection requires a reason, selected from:

- Wrong Amount
- Blurry Bill
- Duplicate Bill
- Invalid Expense
- Other

Rejection history is stored permanently.

## Audit Trail

Every bill maintains:
- Upload Timestamp
- Contractor Review Timestamp
- Admin Review Timestamp
- Rejection History
- Approval History

Records must never be deleted.

## Financial Controls

**Before submission**, the user may change photo, amount, or notes.

**After submission**, the user cannot change photo, amount, or timestamps.

If a correction is required: request cancellation and create a new bill.

## Dashboards

### Laborer Dashboard
**Actions:** Upload Bill · View Balance · View History
**Displays:** Current Balance, Pending Bills, Recent Activity

### Contractor Dashboard
**Actions:** Review Bills · Laborers · Transactions · Balance
**Displays:** Pending Reviews, Approved Today, Rejected Bills, Total Active Laborers

### Admin Dashboard
**Actions:** Pending Approvals · Contractors · Users · Reports · Transactions
**Displays:** Pending Approvals, Today's Expenses, Monthly Expenses, Active Contractors, Active Laborers

## Reports

**Daily:** Bills Submitted, Bills Approved, Bills Rejected, Total Amount

**Monthly:** Contractor-wise Spending, Laborer-wise Spending, Outstanding Amounts

**Export formats:** PDF, Excel

## Notifications

| Role | Example Notification |
|---|---|
| Laborer | "Your bill has been approved." |
| Contractor | "You have 5 bills awaiting review." |
| Admin | "12 contractor-approved bills require approval." |

## Security

- Role-Based Access Control
- Secure Authentication
- Password Hashing
- Server-Generated Timestamps
- Immutable Submitted Bills

Client-side timestamps are never trusted.

## Accessibility

- Large text and large touch targets
- High contrast UI
- Hindi and Marathi language support
- Extremely simple forms with minimal typing
- Camera-first workflows

## Database Schema

```
users
├── id
├── user_id
├── username
├── password_hash
├── role
├── phone
└── created_at

contractors
├── id
├── user_id
└── company_name

laborers
├── id
├── contractor_id
└── user_id

bills
├── id
├── bill_number
├── laborer_id
├── contractor_id
├── image_url
├── amount
├── note
├── status
├── upload_timestamp
├── contractor_review_timestamp
├── admin_review_timestamp
└── created_at

transactions
├── id
├── bill_id
├── amount
├── type
└── created_at

balances
├── user_id
├── current_balance
└── updated_at

audit_logs
├── id
├── entity_type
├── entity_id
├── action
├── performed_by
└── timestamp
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Flutter |
| Backend | Supabase |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| Storage | Supabase Storage |
| Version Control | Git + GitHub |

## Future Features

- OCR Bill Reading
- WhatsApp Notifications
- Offline Mode
- GPS Verification
- Advanced Reports
- Multi-Company Support

## Quality Standard

This application must feel like a mature internal business tool used by hundreds of workers daily.

- Every screen should solve a real task
- Every component should have a purpose
- No decorative UI patterns unless they improve usability
- Clarity over creativity
- Reliability over visual novelty
- Workflow efficiency over visual effects

## License

_Add your license here._
