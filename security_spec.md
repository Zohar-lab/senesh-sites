# Security Specification (Phase 0)

## 1. Data Invariants
1. Students and anonymous visitors may ONLY read `/games` documents whose `status` equals `"מאושר"`. Pending (`"ממתין"`) and rejected (`"נדחה"`) submissions are readable only by the Super Admin (`1001974053@edu-haifa.org.il`) or an Authorized Editor present in `/editors/{email}`.
2. Public site submissions from students (`create` on `/games/{gameId}`) MUST enforce `status == 'ממתין'`, `isFeatured == false` (if present), `tags` subset of `['משחק תחביב', 'חקר', 'מידע', 'חברה', 'מועצת תלמידים', 'מחשבים ורשת']` (`size <= 6`), `creators` bounded (`1..10`, safe display name `<= 35` chars, no `@` emails), `createdAt == request.time`, `updatedAt == request.time`, and strict field type/size bounds. Students cannot self-approve or self-feature a site or inject extra fields.
3. Only the Super Admin or an Authorized Editor may update site `status`, `tags`, `isFeatured`, edit site fields, or delete sites. `createdAt` is immutable after creation.
4. Player feedback (`create` on `/feedbacks/{feedbackId}`) MUST reference an existing game in `/games/$(incoming().gameId)` (`exists()`), enforce `rating` integer/number between 1 and 5, enforce length limits (`playerName` 1..35 without `@`, `comment` 3..350), and bind `createdAt == request.time`.
5. `/editors/{editorEmail}` contains email PII and RBAC roles. Only the Super Admin (`email_verified == true` and `email.lower() == '1001974053@edu-haifa.org.il'`) may create, update, or delete editors, or list the full collection. An authenticated user may read only their own editor record to verify their role.
6. `/portal_settings/{settingId}` is accessible only to verified Super Admin and Authorized Editors.
7. `/game_prompts/{promptId}` documents bind `ownerUid == request.auth.uid` and `ownerEmail == request.auth.token.email.lower()` on creation (`ownerUid`, `ownerEmail`, `createdAt` immutable on update). Only the prompt owner or an Authorized Editor / Super Admin may read, list, update, or delete a prompt. `productionStatus` is restricted to `['ממתין', 'הופק']` and `createdSiteUrl` must be empty or `^https?://.*`.

## 2. "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. Public student attempts `create` on `/games/g1` with `"status": "מאושר"` or `"isFeatured": true` (bypass moderation / self-featuring).
2. Public student attempts `create` on `/games/g1` with ghost field `"isApproved": true` (shadow field injection) or disallowed tag `"ספאם"` in `tags`.
3. Public student attempts `create` on `/games/g1` with `creators` array containing 50 strings or `tags` exceeding 6 entries (unbounded array DoS).
4. Public student attempts `create` on `/games/g1` with forged `createdAt` timestamp not equal to `request.time`.
5. Public student attempts `update` on `/games/g1` to change `status` from `"ממתין"` to `"מאושר"` or set `isFeatured: true`.
6. Unverified Google token (`email_verified: false`) claiming `email: "1001974053@edu-haifa.org.il"` attempts to write `/editors/evil@example.com` (email spoofing).
7. Non-super-admin Authorized Editor attempts to add or delete another editor in `/editors/{email}` (privilege escalation).
8. Anonymous visitor attempts `get` or `list` on `/editors` (PII scraping).
9. Anonymous visitor attempts `list` on `/games` without `status == 'מאושר'` constraint (pending site scraping).
10. Player attempts `create` on `/feedbacks/f1` with `gameId: "non_existent_game"` (orphaned record).
11. Student A attempts `get`, `list`, `update`, or `delete` on Student B's `/game_prompts/{promptId}` document or tries to spoof `ownerUid` on create (IDOR / PII leak).
12. Student attempts `update` on `/game_prompts/{promptId}` altering `ownerUid`, `ownerEmail`, `createdAt`, or setting `createdSiteUrl` to `javascript:alert(1)`.
