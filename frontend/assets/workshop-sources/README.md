# Workshop source artwork

Original PNGs are preserved here for editing and regeneration. They are not copied into the public build.

From `frontend`, run `node scripts/optimize-workshop-background.mjs` to regenerate the served WebP assets in `public/images/workshop`. Pass a source filename to regenerate just that asset, for example `star.png`.

Runtime logos, cube images and flame icons remain in `public` because the application uses them or they are retained paired cube artwork.
