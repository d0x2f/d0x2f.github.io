+++
title = "Generating a Heatmap from Google Location History"
date = "2025-04-20"

tags = ["android", "google", "location", "history", "heatmap"]
+++

# Google Takeout Is No Longer an Option

I used to use [this](https://locationhistoryvisualizer.com/heatmap/) tool to generate a heatmap from my Google Location History data. But now that Google has **removed location history exports from Google Takeout**, those instructions are no longer valid — and even if you use the newer export method, the tool doesn’t work.

Location history is now stored **locally on your phone**, and the export workflow has changed.

# Exporting Your Location History

You can still export your location history — just not through Takeout. Here’s how:

For Android:

1. Go to Settings > Location > Location Services > Timeline.
2. Tap Export Timeline Data.
3. Save the .json file and transfer it to your computer.

For iPhone (I'm reliably informed):

1. Open the Google Maps app.
2. Go to Your Timeline from your profile.
3. Tap the ⋮ menu > Location and privacy settings.
4. Tap Export Timeline Data.
5. Save/share the .json file and transfer it to your computer.

# Generate a Heatmap with Google Maps API

To visualize your data, you’ll need a **Google Maps API key**, which requires a Google Cloud account with billing set up.

I won’t go into the setup here, but you can follow the official [Google Maps API key documentation](https://developers.google.com/maps/documentation/javascript/get-api-key).

# A Minimal Heatmap Web App

Let's create a simple web app that loads the Google Maps SDK, loads our location history file and generates a heatmap.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Location Heatmap</title>
    <style>
      html,
      body,
      #map {
        height: 100%;
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <input type="file" id="fileInput" />
    <button id="submit">Plot</button>
    <div id="map"></div>

    <script>
      const GOOGLE_MAPS_KEY = "YOUR_GOOGLE_MAPS_API_KEY_HERE";

      function pointFromString(str) {
        const coords = str
          .replaceAll("\u00B0", "")
          .split(",")
          .map((s) => parseFloat(s.trim()));
        return new google.maps.LatLng(coords[0], coords[1]);
      }
      function extractPoints(data) {
        const segments = data.semanticSegments ?? [];
        return segments.flatMap(extractPointsFromSegment);
      }

      function extractPointsFromSegment(segment) {
        const points = [];

        collectPathPoints(segment.timelinePath, points);
        collectVisitPoint(segment.visit, points);
        collectActivityPoints(segment.activity, points);

        return points;
      }

      function collectPathPoints(path, points) {
        for (const p of path ?? []) {
          if (p.point) {
            try {
              points.push(pointFromString(p.point));
            } catch (error) {
              console.error(error);
            }
          }
        }
      }

      function collectVisitPoint(visit, points) {
        const loc = visit?.topCandidate?.placeLocation?.latLng;
        const prob = visit?.topCandidate?.probability ?? 0.5;
        if (loc && prob >= 0.5) {
          try {
            points.push(pointFromString(loc));
          } catch (error) {
            console.error(error);
          }
        }
      }

      function collectActivityPoints(activity, points) {
        const start = activity?.start?.latLng;
        const end = activity?.end?.latLng;
        if (start) {
          try {
            points.push(pointFromString(start));
          } catch (error) {
            console.error(error);
          }
        }
        if (end) {
          try {
            points.push(pointFromString(end));
          } catch (error) {
            console.error(error);
          }
        }
      }

      async function renderMap() {
        const file = document.getElementById("fileInput").files[0];
        const json = JSON.parse(await file.text());
        const points = extractPoints(json);

        const map = new google.maps.Map(document.getElementById("map"), {
          zoom: 5,
          center: points[0] ?? { lat: 0, lng: 0 },
        });

        const heatmap = new google.maps.visualization.HeatmapLayer({
          data: points,
          dissipating: true,
          maxIntensity: 10,
        });

        heatmap.setMap(map);
      }

      document.getElementById("submit").addEventListener("click", renderMap);

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=visualization&loading=async`;
      script.async = true;
      document.head.appendChild(script);
    </script>
  </body>
</html>
```

I've also made a hosted version you can use straight away without an API key <a href="generator.html" target="_blank">here</a>.
