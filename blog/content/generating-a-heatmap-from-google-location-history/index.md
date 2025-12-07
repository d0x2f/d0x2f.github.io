+++
title = "Generating a Heatmap from Google Location History"
description = "Using Google Maps Javascript API and Google a location history export from your phone to generate a heatmap overlay that visualises where you've been in the world."
date = "2025-04-20"

[taxonomies]
tags = ["android", "google", "location", "history", "heatmap"]

[extra]
author = "Dylan McGannon"
x_handle = "@D0x2f"

[[extra.images]]
path = "generating-a-heatmap-from-google-location-history/scotland.png"
alt = "Location history heatmap example of Scotland"

[[extra.images]]
path = "generating-a-heatmap-from-google-location-history/south-east-australia.png"
alt = "Location history heatmap example of south east Australia"

[[extra.images]]
path = "generating-a-heatmap-from-google-location-history/japan.png"
alt = "Location history heatmap example of Japan"
+++

## Google Takeout Is No Longer an Option

The tool I used to use to generate a heatmap from my Google Location History data has stopped working due to the recent data migration that moved location history to local storage. In fact, most existing tools were written to process timeline data exported using Google takeout, from which location data is no longer available.

I've written a <a href="generator.html" target="_blank">quick and dirty tool</a> to generate a heatmap based on the location data exported from your phone. You can use that tool directly if you like, it processes everything client-side and you can verify the [source code on github](https://github.com/d0x2f/d0x2f.github.io/blob/main/blog/static/generating-a-heatmap-from-google-location-history/generator.html).

If you're hyper privacy conscious, then I've included a minimal version later in the article that you can code up and run yourself with a bit of setup.

## Exporting Your Location History

You can still export your location history from your phone like so:

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

## Generate a Heatmap with Google Maps API

To visualise your data, you’ll need a **Google Maps API key**, which requires a Google Cloud account with billing set up.

I won’t go into the setup here, but you can follow the official [Google Maps API key documentation](https://developers.google.com/maps/documentation/javascript/get-api-key).

## A Minimal Heatmap Web App

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
      const GOOGLE_MAPS_KEY = "GOOGLE_MAPS_API_KEY";

      function pointFromString(str) {
        const coords = str
          .replaceAll("\u00B0", "")
          .split(",")
          .map((s) => parseFloat(s.trim()));
        return new google.maps.LatLng(
          coords[0],
          coords[1]
        );
      }
      function extractPoints(data) {
        const segments = data.semanticSegments ?? [];
        return segments
          .flatMap(extractPointsFromSegment);
      }

      function extractPointsFromSegment(segment) {
        return [
          ...collectPathPoints(segment.timelinePath),
          ...collectVisitPoint(segment.visit),
          ...collectActivityPoints(segment.activity)
        ]
      }

      function collectPathPoints(path) {
        const points = []
        for (const p of path ?? []) {
          if (p.point) {
            try {
              points.push(pointFromString(p.point));
            } catch (error) {
              console.error(error);
            }
          }
        }
        return points;
      }

      function collectVisitPoint(visit) {
        const points = []
        const loc = visit?
          .topCandidate?
          .placeLocation?
          .latLng;
        const prob = visit?
          .topCandidate?
          .probability ?? 0.5;
        if (loc && prob >= 0.5) {
          try {
            points.push(pointFromString(loc));
          } catch (error) {
            console.error(error);
          }
        }
        return points;
      }

      function collectActivityPoints(activity) {
        const points = []
        const start = activity?.start?.latLng;
        const end = activity?.end?.latLng;
        try {
          if (start) {
              points.push(pointFromString(start));
          }
          if (end) {
              points.push(pointFromString(end));
          }
        } catch (error) {
          console.error(error);
        }
        return points;
      }

      async function renderMap() {
        const file = document
          .getElementById("fileInput")
          .files[0];
        const json = JSON.parse(await file.text());
        const points = extractPoints(json);

        const map = new google.maps.Map(
          document.getElementById("map"),
          {
            zoom: 5,
            center: points[0] ?? { lat: 0, lng: 0 },
          }
        );

        const heatmap = new google.maps.visualization
          .HeatmapLayer({
            data: points,
            dissipating: true,
            maxIntensity: 10,
          }
        );

        heatmap.setMap(map);
      }

      document
        .getElementById("submit")
        .addEventListener("click", renderMap);

      const script = document.createElement("script");
      script.src = 'https://maps.googleapis.com'
        + '/maps/api/js'
        + `?key=${GOOGLE_MAPS_KEY}`
        + '&libraries=visualization'
        + '&loading=async';
      script.async = true;
      document.head.appendChild(script);
    </script>
  </body>
</html>
```

Simply save this in a new html file, update the Google location history API key variable and open it in your favourite browser.
