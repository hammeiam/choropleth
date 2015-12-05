(function(window, d3, topojson) {
  //////// READ-ONLY VARS ////////
  var defaultConfig = {
    onClick: function() {
      console.log("No onClick defined")
    },
    valueName: "value",
    mapSelector: "map",
    dataStore: {},
    currentSelection: {
      zoom: "world"
    },
    loadingHTML: "",
    filePath: {
      "world": "geodata/countries.topo.json",
      "country": "geodata/[country]/states.topo.json"
    }
  };
  var width = 938,
    height = 500;

  //////// CONSTRUCTOR ////////
  var Choropleth = function(userConfig) {
    var config = {};
    Object.keys(defaultConfig).forEach(function(k) {
      config[k] = userConfig[k] || defaultConfig[k];
    })
    this.firstRender = true;
    this.valueName = config.valueName;
    this.dataStore = config.dataStore;
    this.mapSelector = config.mapSelector;
    this.externalOnClick = config.onClick;
    this.currentSelection = config.currentSelection;
    this.el = window.document.getElementById(this.mapSelector);
    this.loader = createLoader(config.loadingHTML, this.el);
    this.filePath = config.filePath;

    var that = this;
    // we invoke externalOnClick at construction to fetch and render 
    (function() {
      that.onClick();
    })()
  }

  //////// PUBLIC FUNCTIONS ////////
  Choropleth.prototype.render = function(selection) {
    var zoom = selection["zoom"];
    this.currentSelection = selection;

    if (this.firstRender){
      onFirstRender.call(this)
    }

    d3.selectAll(".clp-tooltip").remove()

    if (zoom === "world") {
      renderWorld.call(this);
    } else if (zoom === "country") {
      renderCountry.call(this);
    } else if (zoom === "state") {
      renderState.call(this);
    }
  }
  Choropleth.prototype.insert = function(newData, selection) {
    var zoomLevels = ["world", "country", "state"],
      zoomIndex = zoomLevels.indexOf(selection.zoom),
      dataObj = this.dataStore,
      that = this;
    selection.world = "world";
    for (var i = 0; i <= zoomIndex; i++) {
      var zoomLevel = zoomLevels[i],
        zoomItem = zoomLevel === "world" ? "world" : selection[zoomLevel]["name"];
      if (!dataObj) {
        dataObj = {};
      }
      if (!dataObj[zoomItem]) {
        dataObj[zoomItem] = {};
      }
      if (!dataObj[zoomItem]["children"]) {
        dataObj[zoomItem]["children"] = {};
      }
      dataObj = dataObj[zoomItem]["children"];
    }
    Object.keys(newData).forEach(function(key) {
      dataObj[key] = newData[key];
      dataObj[key][that.valueName] = parseFloat(dataObj[key][that.valueName],10);
    });
    return dataObj;
  };

  Choropleth.prototype.get = function(selection) {
    selection = selection || { "zoom": "world" };
    // only returns children because in a choropleth, we only care about the sub-unit's values
    var zoomLevels = ["world", "country", "state"],
      zoomIndex = zoomLevels.indexOf(selection.zoom),
      dataObj = this.dataStore;
    for (var i = 0; i <= zoomIndex; i++) {
      var zoomLevel = zoomLevels[i],
        zoomItem = zoomLevel === "world" ? "world" : selection[zoomLevel]["name"];
      if (!dataObj || !dataObj[zoomItem] || !dataObj[zoomItem]["children"]) {
        return null;
      }
      dataObj = dataObj[zoomItem]["children"];
    }
    return dataObj;
  };

  Choropleth.prototype.getValue = function(data, key) {
    if (data[key] && data[key][this.valueName])
      return data[key][this.valueName];
    return 0;
  };

  Choropleth.prototype.onClick = function(featureData) {
    this.toggleLoader();
    var newSelection = this.currentSelection;
    var zoom = newSelection.zoom;
    // if we clicked a valid feature AND we can zoom closer
    if (featureData && zoom !== "state") {
      var smallerUnit = zoom === "world" ? "country" : "state";
      newSelection[smallerUnit] = {
        name: featureData.properties.name,
        id: featureData.id
      }; // UNIQID
      newSelection.zoom = smallerUnit;
      this.currentFeature = featureData; // may not ever be used
    } else {
      newSelection = {
        zoom: "world"
      };
    }
    this.externalOnClick.call(this, newSelection);
  };

  Choropleth.prototype.toggleLoader = function() {
    // consider doing this with css
    var loaderDisplay = this.loader.style.display;
    this.loader.style.display = loaderDisplay === "none" ? "block" : "none";
  };

  //////// PRIVATE FUNCTIONS ////////
  function onFirstRender(){
    var that = this;
    var elWidth = document.getElementById(that.mapSelector).clientWidth;
    var svg = d3.select("#" + that.mapSelector).insert("svg", ":first-child")
      .attr("class", "clp-svg")
      .attr("preserveAspectRatio", "xMidYMid")
      .attr("viewBox", "0 0 " + width + " " + height)
      .attr("width", elWidth)
      .attr("height", elWidth * height / width);

    svg.append("rect")
      .attr("class", "clp-background")
      .attr("width", width)
      .attr("height", height)
      .on("click", that.onClick.bind(that));

    that.g = svg.append("g");

    var oldOnResizeFn = window.onresize;
    window.onresize = function(){
      var w = document.getElementById(that.mapSelector).clientWidth;
      svg.attr("width", w);
      svg.attr("height", w * height / width);
      if(oldOnResizeFn){ oldOnResizeFn(); }
    }
    that.firstRender = false;
  }

  function renderWorld() {
    var that = this;
    d3.json(getFilePath.call(that, that.currentSelection), function(error, topoData) {
      if (error) return console.error(error);

      var projection = d3.geo.mercator().scale(150).translate([width / 2, height / 1.5]),
        features = topojson.feature(topoData, topoData.objects.countries).features,
        path = d3.geo.path().projection(projection),
        xyz = [width / 2, height / 1.5, 1],
        data = that.get(that.currentSelection),
        minMax = findMinAndMax.call(that, data),
        min = minMax[0],
        max = minMax[1];

      that.toggleLoader();
      that.g.selectAll("g").remove();

      that.g.append("g")
        .selectAll("path")
        .data(features)
        .enter()
        .append("path")
        .attr("data-id", function(d) {
          return d.id || d.properties.name;
        })
        .attr("class", function(d) {
          return "clp-land clp-subunit " + (d.properties.name ? fillColor(min, max, that.getValue(data, d.properties.name)) : "");
        })
        .style("stroke-width", "1px")
        .attr("d", path)
        .on("click", that.onClick.bind(that))
        .on("mouseover", function(d, i) {
          this.parentNode.appendChild(this)
        })
        .call(tooltip.call(that, data,
          function(d, i) { // replace with config
            return "<b>" + d.properties.name + "</b><br/>" + that.valueName + ": " + that.getValue(data, d.properties.name);
          }
        ));

      that.g.attr("transform",
        "translate(" + projection.translate() + ")scale(" + xyz[2] + ")translate(-" + xyz[0] + ",-" + xyz[1] + ")"
      );
    });
  };

  function renderCountry() {
    var that = this,
      country = that.currentSelection.country.id,
      projection;
    if (country === "USA") {
      projection = d3.geo.albersUsa()
        .scale(1000)
        .translate([width / 2, height / 2]);
    } else if (country === "RUS") {
      projection = d3.geo.mercator()
        .rotate([-115, 0])
        .translate([width / 2, height / 1.5]);
    } else {
      projection = d3.geo.mercator().scale(150).translate([width / 2, height / 1.5]);
    }

    d3.json(getFilePath.call(that, that.currentSelection), function(error, topoData) {
      if (error) return console.error(error);
      var features = topojson.feature(topoData, topoData.objects.states).features,
        path = d3.geo.path().projection(projection),
        bounds = path.bounds(that.currentFeature),
        xyz = getXYZ(bounds),
        data = that.get(that.currentSelection),
        minMax = findMinAndMax.call(that, data),
        min = minMax[0],
        max = minMax[1];

      that.toggleLoader();
      that.g.selectAll("g").remove();

      that.g.append("g")
        .style("stroke-width", 1 / xyz[2] + "px")
        .selectAll("path")
        .data(features)
        .enter()
        .append("path")
        .attr("data-id", function(d) {
          return d.id || d.properties.name;
        })
        .attr("class", function(d) {
          return "clp-land clp-subunit " + (d.properties.name ? fillColor(min, max, that.getValue(data, d.properties.name)) : "");
        })
        .attr("d", path)
        .on("click", that.onClick.bind(that))
        .on("mouseover", function(d, i) {
          this.parentNode.appendChild(this)
        })
        .call(tooltip.call(that, data,
          function(d, i) { // replace with config
            return "<b>" + d.properties.name + "</b><br/>" + that.valueName + ": " + that.getValue(data, d.properties.name);
          }
        ));
      if (country !== "USA") {
        that.g.attr("transform",
          "translate(" + projection.translate() + ")scale(" + xyz[2] + ")translate(-" + xyz[0] + ",-" + xyz[1] + ")"
        );
      }
    });
  }

  function renderState() {
    var that = this;
    if (that.currentSelection.country.id === "USA" && that.currentSelection.state.id === "USA-3563") {
      projection = d3.geo.mercator()
        .rotate([15, 0])
        .scale(1000)
        .translate([width / 2, height / 1.5]);
    } else {
      projection = d3.geo.mercator()
        .scale(1000)
        .translate([width / 2, height / 1.5]);
    }
    var path = d3.geo.path().projection(projection),
      bounds = path.bounds(that.currentFeature),
      xyz = getXYZ(bounds),
      data = that.get(that.currentSelection),
      minMax = findMinAndMax.call(that, data),
      min = minMax[0],
      max = minMax[1],
      // sort so largest circles are beneath smaller ones
      sortedData = Object.keys(data).map(function(key) {
        data[key].clpId = key // would overwrite that field if already set
        return data[key];
      }).sort(function(a, b) {
        return that.getValue(data, b.clpId) - that.getValue(data, a.clpId);
      })

    that.toggleLoader();
    that.g.selectAll("g").remove();

    // add our selected state back
    that.g.append("g")
      .selectAll("path")
      .data([that.currentFeature])
      .enter()
      .append("path")
      .attr("data-id", function(d) {
        return d.id || d.properties.name;
      })
      .attr("class", "clp-land")
      .attr("d", path)
      .style("stroke-width", 2 / xyz[2] + "px")
      .on("click", that.onClick.bind(that));

    that.g.append("g")
      .selectAll(".clp-city")
      .data(sortedData)
      .enter()
      .append("circle")
      .attr("r", function(d) {
        return (cityRadius(min, max, that.getValue(data, d.clpId)) / xyz[2])
      })
      .attr("data-id", function(d) {
        return d.clpId
      })
      .attr("class", function(d) {
        return "clp-city clp-subunit " + (d.clpId ? fillColor(min, max, that.getValue(data, d.clpId)) : "");
      })
      .style("stroke-width", 2 / xyz[2] + "px")
      .attr("transform", function(d) {
        return "translate(" + projection([d.long, d.lat]) + ")";
      })
      .on("click", that.onClick.bind(that))
      .call(tooltip.call(that, data,
        function(d, i) {
          return "<b>" + d.clpId + "</b><br/>" + that.valueName + ": " + that.getValue(data, d.clpId);
        }
      ));
    console.log(xyz[2])
    that.g.attr("transform",
      "translate(" + projection.translate() + ")scale(" + xyz[2] + ")translate(" + -1 * xyz[0] + "," + -1 * xyz[1] + ")"
    );

  }

  function findMinAndMax(data) {
    var that = this, maxValue, minValue;
    Object.keys(data).forEach(function(key) {
      var val = that.getValue(data, key);
      if (!maxValue || maxValue < val)
        maxValue = val
      if (!minValue || minValue > val)
        minValue = val
    })
    return [minValue, maxValue];
  }

  function fillColor(min, max, value) {
    if (value === 0)
      return "clp-color-scale-0";
    else if (value === min)
      return "clp-color-scale-1";
    var fill = d3.scale.quantize()
      .domain([min, max])
      .range(d3.range(1, 6)
        .map(function(i) {
          return "clp-color-scale-" + i;
        }));
    return fill(value);
  }

  function cityRadius(min, max, value) {
    if (value === min)
      return 15;
    var radius = d3.scale.quantize()
      .domain([min, max])
      .range(d3.range(10, 50, 5));
    return radius(value);
  }

  function tooltip(data, accessor) {
    var that = this;
    // from http://bl.ocks.org/rveciana/5181105
    return function(selection) {
      var tooltipDiv;
      var bodyNode = d3.select("body").node();
      selection.on("mouseover.tooltip", function(d, i) {
          if (that.getValue(data, d.properties.name) === 0) {
            return;
          }
          // Clean up lost tooltips
          d3.select("body").selectAll("div.clp-tooltip").remove();
          // Append tooltip
          tooltipDiv = d3.select("body").append("div").attr("class", "clp-tooltip");
          var absoluteMousePos = d3.mouse(bodyNode);
          tooltipDiv.style("left", (absoluteMousePos[0] + 20) + "px")
            .style("top", (absoluteMousePos[1] - 25) + "px")
            .style("position", "absolute")
            .style("z-index", 2);
          // Add text using the accessor function
          var tooltipText = accessor(d, i) || "";
        })
        .on("mousemove.tooltip", function(d, i) {
          if (that.getValue(data, d.properties.name) === 0) {
            return;
          }
          // Move tooltip
          var absoluteMousePos = d3.mouse(bodyNode);
          tooltipDiv.style("left", (absoluteMousePos[0] + 10) + "px")
            .style("top", (absoluteMousePos[1] - 15) + "px");
          var tooltipText = accessor(d, i) || "";
          tooltipDiv.html(tooltipText);
        })
        .on("mouseout.tooltip", function(d, i) {
          if (that.getValue(data, d.properties.name) === 0) {
            return;
          }
          // Remove tooltip
          tooltipDiv.remove();
        });
    };
  };

  function createLoader(centerHTML, parentEl) {
    var loader = window.document.createElement("div");
    loader.className = "clp-loader";
    loader.style.display = "none";

    var loaderCenter = window.document.createElement("div");
    loaderCenter.className = "clp-loaderCenter";
    loaderCenter.innerHTML = centerHTML || "";

    loader.appendChild(loaderCenter);
    parentEl.appendChild(loader);
    return loader;
  }

  function getFilePath(selection) {
    var zoom = selection.zoom,
      path = this.filePath[zoom]
    if (zoom === "country")
      return path.replace(/\[country\]/, selection.country.id)
    return path;
  }

  function getXYZ(bounds) {
    var w_scale = (bounds[1][0] - bounds[0][0]) / width;
    var h_scale = (bounds[1][1] - bounds[0][1]) / height;
    var z = .96 / Math.max(w_scale, h_scale);
    var x = (bounds[1][0] + bounds[0][0]) / 2;
    var y = (bounds[1][1] + bounds[0][1]) / 2 + (height / z / 6);
    return [x, y, z];
  }

  function objectsAreEqual(firstObj, secondObj) {
    if (!firstObj || !secondObj) {
      return false;
    }
    var firstObjKeys = Object.keys(firstObj),
      secondObjKeys = Object.keys(secondObj),
      result = true;
    if (firstObjKeys.length !== secondObjKeys.length) {
      return false;
    }
    for (var i = 0; i < firstObjKeys.length; i++) {
      var key = firstObjKeys[i],
        firstObjVal = firstObj[key],
        secondObjVal = secondObj[key],
        firstObjValType = getType(firstObjVal),
        secondObjValType = getType(secondObjVal);
      if (firstObjValType !== secondObjValType) {
        result = false;
      }
      if (["string", "number", "boolean"].indexOf(firstObjValType) !== -1) {
        result = firstObjVal === secondObjVal;
      } else if (["object", "array"].indexOf(firstObjValType) !== -1) {
        result = objectsAreEqual(firstObjVal, secondObjVal);
      } else {
        result = false;
      }
      if (result === false) {
        break;
      }
    };
    return result; //Boolean
  }

  function getType(obj) {
    if (typeof obj !== "object")
      return typeof obj;
    if (obj === null)
      return "null";
    //object, array, function, date, regexp, string, number, boolean, error
    var internalClass = Object.prototype.toString.call(obj)
      .match(/\[object\s(\w+)\]/)[1];
    return internalClass.toLowerCase();
  }

  if (typeof(d3) === "undefined") {
    console.log("Choropleth requires d3: http://d3js.org");
  } else if (typeof(topojson) === "undefined") {
    console.log("Choropleth requires topojson: https://github.com/mbostock/topojson");
  } else {
    if (typeof(window.Choropleth) === "undefined") {
      window.Choropleth = Choropleth;
    } else {
      console.log("Choropleth already defined.");
    }
  };
})(window, d3, topojson);