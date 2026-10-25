# ReadFlow Workspace Cleanup

Completed October 25, 2026, at the owner's request to remove unnecessary local
files while preserving useful history, decisions and future development/recovery.
Scope: the existing ReadFlow folder only. No cloud account, phone data or external
folder was deleted. No application source or behavior was changed.

## Result

Removed 125 explicit targets containing 45,111 files. Their combined logical file
size was 12,258,387,317 bytes (12.26 GB, decimal). Calculated by summing file lengths
in the pre-deletion inventory, then verifying all planned target paths were absent.
This is not a measurement of reclaimed physical disk space: OneDrive placeholders,
compression and filesystem allocation can differ from logical file sizes.

| Removed category | Targets | Files | Bytes |
| --- | ---: | ---: | ---: |
| Superseded APK/AAB build binaries | 49 | 49 | 10,132,987,628 |
| Regenerable build/download/Python caches | 10 | 45,061 | 2,114,135,055 |
| Duplicate downloaded scrcpy installer ZIP | 1 | 1 | 11,264,634 |
| Empty generated temporary directories | 65 | 0 | 0 |

The entire folder was inventoried: 123,603 files, 19,112,883,838 logical bytes,
with no enumeration errors. No post-cleanup whole-folder size is asserted.

## Retained

- Current mobile/backend/website source, assets, lockfiles, patches and OCR models.
- All Git history, branches and existing tags; no history pruning or reset.
- Handover, architecture, decision/rationale, quality, account and checkpoint notes.
- Production1.0.69(76) AAB and Google-signed APK, plus previous production73 AAB.
- Test books, original owner files, screenshots, transcripts/audio and QA evidence.
- Credentials/signing material, installed SDK/JDK/audio tools and current dependencies.
- Small historical source/deployment snapshots that may contain unique material.
- Existing uncommitted website changes and owner backup.ab, pic/ and saeed-tester.csv.

Retained release SHA256 values, read after cleanup:

- artifacts/readflow-1.0.69-76-free-production.aab:
  68DAAD0956CEA0CBE8759E3A84BFEB81016F4B190B87268ED4CE8D0953ACC8EA
- artifacts/readflow-1.0.69-76-google-signed.apk:
  F348DBCF9DEA9D9D0DE098E1BCDDC508EC6FE80D5B4D5D142E5627127A3B1ADA
- artifacts/readflow-1.0.66-73-internal.aab:
  335964023DCD72DEE5A881DC0111EDFDDF5DB51334444FEF41FB2D895625BB03

The current76 hashes match the earlier release record. The previous73 bundle is
retained for reference/recovery, not a claim that Play permits a version-code downgrade.

## Rationale and Recovery

Older binary outputs are redundant for current distribution and are not the source
history. Their names, sizes and checksums remain in the local deletion plan. Prior
documentation references to those local binaries are historical; consult this record
if a referenced old APK/AAB is absent. They are not promised to be reproducible bit
for bit, and remote availability was not rechecked as part of this cleanup.

Removed caches include tmp/gradle-free, tmp/npm-cache, tmp/node-compile-cache,
generated mobile Android build caches, old Android-backup build caches and script
bytecode. Future builds may recreate caches or download dependencies again. Native
source, installed dependencies and the extracted scrcpy tool remain available.

Detailed private local audit files remain under tmp/cleanup-20261025/: inventory.csv,
inventory-summary.json, deletion-plan.json, deletion-results.json, inventory.ps1 and
cleanup.ps1. Do not upload the full workspace inventory or credential-related files.
The deletion helper is a dated, completed operation, not a reusable cleanup command.

Each deletion target was resolved and checked inside the exact workspace, excluded
tracked files/protected releases, rejected filesystem links and checked for changes
since inventory. A PowerShell path-argument error in the first planning attempt was
corrected before deletion; the completed execution had no failed targets. Git status
after deletion showed only the same pre-existing website edits; generated Python
bytecode was removed. No app tests or new builds were run for this filesystem task.

Before tag: readflow-before-workspace-cleanup-20261025.
After tag: readflow-after-workspace-cleanup-20261025.
