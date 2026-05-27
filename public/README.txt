INSTALL:

1. Copy all PNG/ICO/manifest files into your project public folder.
2. Replace your project index.html with the included index.html, OR copy the favicon lines into your existing <head>.
3. Run:

cd ~/Desktop/nca-maintenance
npm run build
git add .
git commit -m "add custom MNC maintenance logo favicon"
git push

If the old tab icon still shows, hard refresh with Command + Shift + R or clear browser favicon cache.
