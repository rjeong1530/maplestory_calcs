# Laddering with spare potential preparation

Import [spare-potential.json](spare-potential.json) through **Equipment setup →
Import JSON**, then **Save equips**. Export your current equipment first if you
want to keep it: importing replaces the equipment set and class.

This Hero sample contains a Guardian Angel Ring:

- Equipped copy: 24 stars, 33% STR potential.
- Spare copy: 23 stars, 13% STR potential.
- Laddering starts at 24 stars; upgrades stop at 25.
- Replacement cost is zero. Rings cannot receive flames, so this example isolates
  potential preparation. The zero minimum fields are legacy format placeholders;
  the calculator determines the actual targets.

In **Stats & upgrades**, enable Star Force and Potential (Flames can stay enabled),
select Black cubes, leave cube sale off, enable Shining Star Force Sunday, and use
MVP None. The file includes the default score weights, but calculation event and
cube settings are not imported. Calculate and open **Overall**.

With these settings, the second projected step ladders the spare from 23 to 25
stars and rolls its potential to a minimum weighted score of 284. It includes
about 124.28 expected Black cubes (2.73B mesos) plus 97.78B mesos of Star Force,
for about 100.52B combined. The equipped copy remains safe until the swap.
Earlier projected upgrades affect the comparison score; targets and order change
with weights, events, cube settings, or actual rolls. These are expected costs,
not guaranteed budgets.

The sample was verified through the frontend importer/request builder and backend
planner with Shining both on and off. Both produce a laddering recommendation
with positive Star Force and potential preparation costs.
