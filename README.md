# Lehar Portal: demo

Student journey portal for Samudra Global, built by IC Solutions.

This repository holds the **demo** only. On GitHub Pages it runs entirely in the browser with sample data. Nothing is sent to a server, and emails appear on the "Demo outbox" page.

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@icsoln.com | Admin123 |
| Manager | manager@icsoln.com | Manager123 |
| Counsellor | counsellor@icsoln.com | Counsellor123 |

A Manager can do everything an Admin does except add, change or remove users. A Counsellor sees only the students assigned to them and has no reports.

The sample data also includes a second counsellor (priya@icsoln.com / Counsellor123) and sample sign-in history for the Activity log.

To try the chat, open the demo in two browser tabs: sign in as Admin in one and Counsellor in the other.

The live version (Node.js + MySQL) uses the same front end and is deployed separately on the VPS.
