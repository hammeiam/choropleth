# Choropleth 

Choropleth aspires to be a javascript library for quickly and easily creating interactive choropleth maps using D3. All it will require is access to an endpoint to query location data. The library also allows you to sync data between other visualizations - clicking a country on the map will show you data for the states of that country, but you can trivially show that same data in an accompanying table or chart that is up to date with the current map selection.

### Current status:
I have a rough cut finished. I'm still toying with the idea of adding things like zooming to/from a selection, adding a spinner while data loads, and refactoring the whole thing in ES6 and Webpack. Overall, I'd say it's about 60% there. 