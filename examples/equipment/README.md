# Equipment samples

These 47 JSON files cover every class currently supported by the app. Each has
eight items: weapon, secondary, hat, top, bottom, gloves, ring, and pendant.
They are test builds, not recommended gear sets. The samples exercise physical
and magic offense, all primary stat types, class-specific secondaries, Xenon's
three primary stats, and Bishop's negative cooldown potential value.

To try one, open **Equipment setup → Import JSON** and select a file here.
Export your existing equipment first if you want to keep it: importing replaces
the current equipment and class. Open **Stats & upgrades** to inspect the rolls
and calculate the upgrade order. Most sample items have 17 stars and an upgrade
limit of 18 to keep the results small. The fixed fourth ring is added by the app.
Demon Avenger's HP Star Force scoring is still unsupported and should report
that limitation; flames and potential should calculate normally.

Regenerate the files from the bundled catalog, from the repository root:

```powershell
node frontend/scripts/equipment-samples.mjs
```

Run the checks:

```powershell
npm --prefix frontend test
.\.venv\Scripts\python.exe -m unittest backend.tests.test_equipment_samples -v
```

The frontend suite checks all sample round trips, browser restoration, request
serialization, and all 2,209 class-to-class equipment transitions. It also tests
malformed rolls and saved weights. The backend suite uses Node to run the actual
frontend importer and request builder, then checks every recorded roll against
the editor's API options and calculates all three upgrade categories for each
class. The backend integration test is skipped if Node is unavailable.

These checks cover data and API behavior; they do not automate browser clicks
or visually inspect layout. The shared secondary potential mapping is retained
and tested against the identical bundled Force Shield, Soul Ring, and shield
tables for both cube types.
