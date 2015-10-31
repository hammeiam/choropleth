(function(window, d3, topojson, $){
	'use strict';
		// if (window === this) {
	 //    return new Choropleth();
		// }

	//// global private vars ////
	var zoom, country, state, data, max, landFill, cityFill, self;
	var filePath, id, features, className,
		beforeRender = function(){},
		afterRender = function(){};
	var m_width,
		width = 938,
		height = 500;

	var Choropleth = function(config){
		self = this;
		this.valueName = config.valueName || 'value';
		this.mapSelector = config.mapSelector;
		this.el = window.document.getElementById(self.mapSelector.slice(1));
		m_width = $(self.mapSelector).width(),
		this.dataStore = config.dataStore;
		this.currentSelection = { zoom: 'world' };
		this.firstRender = true;
		this.projection = d3.geo.mercator().scale(150).translate([width / 2, height / 1.5]);
		this.path = function(){
			return d3.geo.path().projection(self.projection)
		}
		this.loader = window.document.createElement("div");
		this.loader.className = "loader";
		this.loader.style.display = "none";
		var loaderCenter = window.document.createElement("div");
		loaderCenter.className = "loaderCenter";
		if(config.loadingText)
			loaderCenter.innerHTML = config.loadingText
		this.loader.appendChild(loaderCenter);
		this.el.appendChild(this.loader);

		this.onClick = function(featureData){
			toggleLoader()
			var newSelection = this.currentSelection;
			var zoom = newSelection.zoom;
			// if we clicked a valid feature AND we can zoom closer
			if(featureData && (zoom === 'world' || zoom === 'country')){
					var smallerUnit = zoom === 'world' ? 'country' : 'state';
					newSelection.zoom = smallerUnit
					newSelection[smallerUnit] = featureData.id;
					this.currentFeature = featureData;
			} else {
				newSelection = { zoom:'world' };
			}
			config.onClick.call(this, newSelection);
		}.bind(this);
		// consider just making this required 
		if(typeof(window[config.dataStore]) === 'undefined')
			window[config.dataStore] = {};
		this.onClick();
		return this;
	};

	Choropleth.prototype = {
		render: function(selection){
			var self = this;
			self.currentSelection = selection;
			// SETUP
			zoom = selection['zoom'],
			country = selection['country'],
			state = selection['state'],
			data = self.get(selection),
			max = d3.max(d3.values(data), function(i){ return i[self.valueName]; }),
			landFill = d3.scale.quantize().domain([0, max])
				.range(d3.range(5).map(function(i) { return "color-scale-" + i; }));
			cityFill = d3.scale.quantize().domain([0, max])
				.range(d3.range(1,5,0.5));

			if(self.firstRender){
				var svg = d3.select(self.mapSelector).insert("svg", ":first-child")
				.attr("preserveAspectRatio", "xMidYMid")
				.attr("viewBox", "0 0 " + width + " " + height)
				.attr("width", m_width)
				.attr("height", m_width * height / width);

				svg.append("rect")
				.attr("class", "background")
				.attr("width", width)
				.attr("height", height)
				.on("click", self.onClick);

				self.g = svg.append("g")
				.attr("id", "map-content");

				$(window).resize(function() {
					var w = $("#map").width();
					svg.attr("width", w);
					svg.attr("height", w * height / width);
				});
			};

			if(zoom === 'world'){
				renderWorld();
			} else if(zoom === 'country'){
				renderCountry();
			} else if(zoom === 'state'){
				renderState();
			}
			self.firstRender = false;			
			},

			insert: function(newData, selection){
				// inserting {PA: 1, CA: 3, NY: 5} into data[world][usa]
				var existingData = this.get(selection);
				if(existingData){
					return existingData;
				} else {
					var zoom = selection['zoom'],
					country = selection['country'],
					state = selection['state'],
					dataStore = this['dataStore'],
					destination;
					switch(zoom){
						case 'world':
							if(!dataStore['world'])
								dataStore['world'] = {};
							destination = dataStore['world'];
							break;
						case 'country':
							if(!dataStore['world']['children'][country])
								dataStore['world']['children'][country] = {};
							destination = dataStore['world']['children'][country];
							break;
						case 'state':
							if(!dataStore['world']['children'][country]['children'][state])
								dataStore['world']['children'][country]['children'][state] = {};
							destination = dataStore['world']['children'][country]['children'][state];
							break;
					}
					destination['children'] = {};
					Object.keys(newData).forEach(function(key){
						destination['children'][key] = newData[key];
					});

					return destination['children'];
				}
			},

			get: function(selection){
				var zoom = selection['zoom'],
				country = selection['country'],
				state = selection['state'],
				data = this['dataStore'],
				output;
				// could these be improved by try/catch ?
				switch(zoom){
					case 'world':
						if(data['world'] && data['world']['children'])
							output = data['world']['children'];
						break;
					case 'country':
						if(data['world'] && 
							data['world']['children'][country] && 
							data['world']['children'][country]['children']){
							output = data['world']['children'][country]['children'];
						}
						break;
				case 'state':
					if(data['world'] && 
						data['world']['children'][country] && 
						data['world']['children'][country]['children'][state] &&
						data['world']['children'][country]['children'][state]['children']){
						output = data['world']['children'][country]['children'][state]['children'];
					}
					break;
				}
				return output || null;
			}
		};

	//// RENDER FUNCTIONS ////
	function renderWorld(){
		//// NOTES:
		// hide tooltip for empty values (all renders)

		beforeRender = function(){
			self.projection = d3.geo.mercator().scale(150).translate([width / 2, height / 1.5]);;
		};
		afterRender = function(){
			var xyz = [width / 2, height / 1.5, 1];
			self.g.attr("transform", 
				"translate(" + self.projection.translate() + ")scale(" + xyz[2] + ")translate(-" + xyz[0] + ",-" + xyz[1] + ")")
		}
		filePath = "geodata/countries.topo.json";
		id = "countries";
		features = function(topoData){return topojson.feature(topoData, topoData.objects.countries).features};
		className = "country ";

		d3.json(filePath, function(error, topoData) {
			if (error) return console.error(error);
			toggleLoader()
			beforeRender();

			self.g.selectAll("g").remove();
			self.g.append("g")
			.attr("id", id)
			.selectAll("path")
			.data(features(topoData))
			.enter()
			.append("path")
			.attr("id", function(d) { return d.id || d.properties.name; })
			.attr("class", function(d) { return className + (d.id ? landFill(getValue(data, d.id)) : '');  })
			.attr("d", self.path())
			.on("click", self.onClick)
			.call(tooltip(
        function(d, i){
        	return "<b>"+ d.properties.name + "</b><br/>" + self.valueName + ": "+getValue(data,d.id);	
        }
       ));

			afterRender();
		});
	}

	function renderCountry(){
		if(country === 'USA'){
			beforeRender = function(){
				self.projection = d3.geo.albersUsa()
				.scale(1000).translate([width / 2, height / 1.7]);
			}
		} else if(country === 'RUS'){
			beforeRender = function(){
				self.projection = d3.geo.albers()
					.rotate([-105, 0])
				  .center([-10, 65])
				  .parallels([52, 64])
				  .scale(700)
				  .translate([width / 2, height / 2]);
			}
			afterRender = function(){
				var bounds = self.path().bounds(self.currentFeature)
				var xyz = getXYZ(bounds, width, height);
				self.g.attr("transform", "translate(" + self.projection.translate() + ")scale(" + xyz[2] + ")translate(-" + xyz[0] + ",-" + xyz[1] + ")")
				.selectAll(["#countries", "#states", "#cities"])
				.style("stroke-width", 1.0 / xyz[2] + "px")
			}
		}else {
			afterRender = function(){
				var bounds = self.path().bounds(self.currentFeature)
				var xyz = getXYZ(bounds, width, height);
				self.g.attr("transform", "translate(" + self.projection.translate() + ")scale(" + xyz[2] + ")translate(-" + xyz[0] + ",-" + xyz[1] + ")")
				.selectAll(["#countries", "#states", "#cities"])
				.style("stroke-width", 1.0 / xyz[2] + "px")
			}
		};
		filePath = "geodata/" + country + "/states.topo.json";
		id = "states";
		features = function(topoData){return topojson.feature(topoData, topoData.objects.states).features};
		className = "state "
		d3.json(filePath, function(error, topoData) {
			if (error) return console.error(error);
			toggleLoader()
			beforeRender();

			self.g.selectAll("g").remove();
			self.g.append("g")
			.attr("id", id)
			.selectAll("path")
			.data(features(topoData))
			.enter()
			.append("path")
			.attr("id", function(d) { return d.id || d.properties.name; })
			.attr("class", function(d) { return className + (d.id ? landFill(getValue(data, d.id)) : '');  })
			.attr("d", self.path())
			.on("click", self.onClick)
			.call(tooltip(
        function(d, i){
        	return "<b>"+ d.properties.name + "</b><br/>" + self.valueName + ": "+getValue(data,d.id);	
        }
       ));

			afterRender();
		});
	}

	function renderState(){
		toggleLoader()
		//NOTES:
		// - (done) make sure that bigger cities are stacked behind smaller ones
		// outlines or different colors will be req'd to differentiate
		// - pull out stroke vals into set-able vars
		// - rotate for alaska so it's not split
		// - I don't understand how scaling only affects the circles (inversely)
		// but not the rest of the map. wtf. 

		// remove old projection
		self.g.select("#states").remove()
		// change/ update projection
		self.projection = d3.geo.mercator().scale(1000).translate([width / 2, height / 1.5]);
		var bounds = self.path().bounds(self.currentFeature)
		var xyz = getXYZ(bounds, width, height);
		// sort so largest circles are beneath smaller ones
		var sortedData = Object.keys(data).map(function(key){
			data[key].id = key
			return data[key];
		}).sort(function(a,b){
			return getValue(data,b) - getValue(data,a);
		})

		// add our selected state back
		self.g.append("g")
			.attr("id", id)
			.selectAll("path")
			.data([self.currentFeature])
			.enter()
			.append("path")
			.attr("id", function(d) { return d.id || d.properties.name; })
			.attr("class", 'state active-land')
			.attr("d", self.path())
			.on("click", self.onClick);

		self.g.insert("g", "#loader")
			.attr("id", "cities")
			.selectAll(".city")
			.data(sortedData)
		.enter()
			.append("circle")
			.attr("r", function(d){ return cityFill(getValue(data,d.id)) })
			.style("fill", "#FF9933" )
			.style("stroke", "white")
			.style("stroke-width", ".2px")
			.attr("id", function(d){ return d.id })
			.attr("class", "city")
			.attr("transform", function(d) {
			  return "translate(" + self.projection([ d.long, d.lat ]) + ")";
			})
			.on("click", self.onClick)
			.call(tooltip(
        function(d, i){
          return "<b>"+ d.id + "</b><br/>" + self.valueName + ": " + getValue(data,d.id);
        }
      ));

		
		self.g.attr("transform", "translate(" + self.projection.translate() + ")scale(" + xyz[2] + ")translate(" + -1*xyz[0] + "," + -1*xyz[1] + ")")
			.selectAll("#states")
			.style("stroke-width", 2 / xyz[2] + "px")
	}

	//// HELPER FUNCTIONS ////

	function toggleLoader(){
		if(self.loader.style.display === "none")
			self.loader.style.display = "block"
		else
			self.loader.style.display = "none"
	}

	function tooltip(accessor){
		// from http://bl.ocks.org/rveciana/5181105
    return function(selection){
      var tooltipDiv;
      var bodyNode = d3.select('body').node();
      selection.on("mouseover", function(d, i){
      	if(getValue(data,d.id) === 0){ return; }  		
        // Clean up lost tooltips
        d3.select('body').selectAll('div.tooltip').remove();
        // Append tooltip
        tooltipDiv = d3.select('body').append('div').attr('class', 'tooltip');
        var absoluteMousePos = d3.mouse(bodyNode);
        tooltipDiv.style('left', (absoluteMousePos[0] + 20)+'px')
          .style('top', (absoluteMousePos[1] - 25)+'px')
          .style('position', 'absolute') 
          .style('z-index', 2);
        // Add text using the accessor function
        var tooltipText = accessor(d, i) || '';
        // Crop text arbitrarily
        //tooltipDiv.style('width', function(d, i){return (tooltipText.length > 80) ? '300px' : null;})
        //    .html(tooltipText);
      })
      .on('mousemove', function(d, i) {
      	if(getValue(data,d.id) === 0){ return; }  		
        // Move tooltip
        var absoluteMousePos = d3.mouse(bodyNode);
        tooltipDiv.style('left', (absoluteMousePos[0] + 10)+'px')
          .style('top', (absoluteMousePos[1] - 15)+'px');
        var tooltipText = accessor(d, i) || '';
        tooltipDiv.html(tooltipText);
      })
      .on("mouseout", function(d, i){
      	if(getValue(data,d.id) === 0){ return; }  		
        // Remove tooltip
        tooltipDiv.remove();
      });
	  };
	};

	function getValue(data, key){
		if(data[key] && data[key][self.valueName])
			return data[key][self.valueName];
		return 0;
	}

	// calculates scale for zooming into features
	function getXYZ(bounds, width, height){
		var w_scale = (bounds[1][0] - bounds[0][0]) / width;
		var h_scale = (bounds[1][1] - bounds[0][1]) / height;
		var z = .96 / Math.max(w_scale, h_scale);
		var x = (bounds[1][0] + bounds[0][0]) / 2;
		var y = (bounds[1][1] + bounds[0][1]) / 2 + (height / z / 6);
		return [x, y, z];
	};

	// determines equality of two objects
	function objectsAreEqual(firstObj, secondObj){
		var firstObjKeys = Object.keys(firstObj),
			secondObjKeys  = Object.keys(secondObj),
			result = true;
		if(firstObjKeys.length !== secondObjKeys.length){ return false }
		for(var i = 0; i < firstObjKeys.length; i++){
			var key = firstObjKeys[i],
				firstObjVal  = firstObj[key],
				secondObjVal = secondObj[key],
				firstObjValType  = getType(firstObjVal),
				secondObjValType = getType(secondObjVal);
			if(firstObjValType !== secondObjValType){ result = false; }
			if(['string', 'number', 'boolean'].indexOf(firstObjValType) !== -1){
				result = firstObjVal === secondObjVal;
			} else if(['object', 'array'].indexOf(firstObjValType) !== -1){
				result = objectsAreEqual(firstObjVal, secondObjVal);
			} else {
				result = false;
			}
			if(result === false){ break; }
		};
		return result; //Boolean
	};

	// returns an object's type
	function getType(o) {
		if (typeof o != 'object')
			return typeof o;
		if (o === null)
			return 'null';
	  //object, array, function, date, regexp, string, number, boolean, error
	  var internalClass = Object.prototype.toString.call(o)
	  .match(/\[object\s(\w+)\]/)[1];
	  return internalClass.toLowerCase(); //String
	};

	if(typeof(d3) === 'undefined'){
		console.log("Choropleth requires d3: http://d3js.org");
	}else if(typeof($) === 'undefined'){
		console.log("Choropleth requires jQuery: http://jquery.org");
	}else{
		if(typeof(window.Choropleth) === 'undefined'){
			window.Choropleth = Choropleth;
		}else{
			console.log("Choropleth already defined.");
		}
	};
})(window, d3, topojson, $);

// dataObj = {
// 	"world": {
// 		"value": 1, 
// 		"children": {
// 			"USA": {
// 				"value": 717,
// 				"children": {
// 					"CA": {
// 						"value": 200,
// 						"children": {
// 							"San Francisco": { "value": 70 }, 
// 							"Los Angeles": { "value": 36 }, 
// 							"San Diego": { "value": 5 }
// 						}
// 					},
// 					"PA": {
// 						"value": 175,
// 						"children": {
// 							"Philadelphia": { "value": 14 }
// 						}
// 					}
// 				}
// 			}
// 		}
// 	}
// }