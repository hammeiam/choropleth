(function(window, d3, topojson, $){
		'use strict';
		// if (window === this) {
	 //    return new Choropleth();
		// }
		var Choropleth = function(config){
			this.currentSelection = { zoom: 'world' };
			this.mapSelector = config.mapSelector;
			this.dataStore = config.dataStore;
			this.projection = d3.geo.mercator().scale(150);
			this.path = d3.geo.path().projection(this.projection);
			this.firstRender = true;
			

			this.onClick = function(featureData){
				var newSelection = this.currentSelection;
				switch(this.currentSelection.zoom){
					case 'world':
						newSelection.zoom = 'country';
						newSelection.country = featureData.id;
						this.currentFeature = {
							id: featureData.id,
							name: featureData.name,
							bounds: this.path.bounds(featureData)
						};
						break;
					case 'country':
						newSelection.zoom = 'state';
						newSelection.state = featureData.id;
						this.currentFeature = {
							id: featureData.id,
							name: featureData.name,
							bounds: this.path.bounds(featureData)
						};
						break;
					case 'state':
						newSelection = { zoom:'world' };
						break;
				}
				
				config.onClick.call(null, newSelection);
			}.bind(this)
			if(typeof(window[config.dataStore]) === 'undefined')
					window[config.dataStore] = {};
			return this;
		};

		Choropleth.prototype = {
			render: function(selection){
				var self = this;
				self.currentSelection = selection;
				// SETUP
				var zoom = selection['zoom'],
					country = selection['country'],
					state = selection['state'],
					data = this.get(selection);
				var m_width = $(self.mapSelector).width(),
					width = 938,
					height = 500;
				var max = d3.max(d3.values(data), function(i){
					return i.value;
				});
				var fill = d3.scale.quantize()
			   .domain([0, max])
			   .range(d3.range(5).map(function(i) { return "color-scale-" + i; }));
			  var getValue = function(key){
					if(data[key] && data[key]['value'])
						return data[key]['value'];
					return 0;
				};

				if(self.firstRender){
					var svg = d3.select(self.mapSelector).append("svg")
						.attr("preserveAspectRatio", "xMidYMid")
						.attr("viewBox", "0 0 " + width + " " + height)
						.attr("width", m_width)
						.attr("height", m_width * height / width);
					svg.append("rect")
						.attr("class", "background")
						.attr("width", width)
						.attr("height", height);
					self.g = svg.append("g");

					$(window).resize(function() {
					  var w = $("#map").width();
					  svg.attr("width", w);
					  svg.attr("height", w * height / width);
					});
				};
				
				var filePath, id, features, className,
				beforeRender = function(){},
				afterRender = function(){};
				switch(zoom){
					case 'world':
						beforeRender = function(){
							self.projection = d3.geo.mercator().scale(150).translate([width / 2, height / 1.5]);
							self.path = d3.geo.path().projection(self.projection);
						}
						filePath = "geodata/countries.topo.json";
						id = "countries";
						features = function(topoData){return topojson.feature(topoData, topoData.objects.countries).features};
						className = "country "
						break;
					case 'country':
						if(country === 'USA'){
							beforeRender = function(){
								self.projection = d3.geo.albersUsa()
				    			.scale(800).translate([width / 2, height / 2]);
				    			self.path = d3.geo.path().projection(self.projection);
				    	}
						} else if(country === 'RUS'){
							// make sure that the country isn't split on 2 sides of the map somehow
							beforeRender = function(){
								var xyz = getXYZ(self.currentFeature.bounds, width, height);
								self.projection.translate(["-" + xyz[0],"-" + xyz[1]]);
				    			self.path = d3.geo.path().projection(self.projection);
				    	}
				    	afterRender = function(){
								var xyz = getXYZ(self.currentFeature.bounds, width, height);
	    					self.g.attr("transform", "translate(" + self.projection.translate() + ")scale(" + xyz[2] + ")translate(-" + xyz[0] + ",-" + xyz[1] + ")")
		    					.selectAll(["#countries", "#states", "#cities"])
	    						.style("stroke-width", 1.0 / xyz[2] + "px")
	    				}
						}else {
							afterRender = function(){
								var xyz = getXYZ(self.currentFeature.bounds, width, height);
	    					self.g.attr("transform", "translate(" + self.projection.translate() + ")scale(" + xyz[2] + ")translate(-" + xyz[0] + ",-" + xyz[1] + ")")
		    					.selectAll(["#countries", "#states", "#cities"])
	    						.style("stroke-width", 1.0 / xyz[2] + "px")
	    				}
						}
						filePath = "geodata/" + country + "/states.topo.json";
						id = "states";
						features = function(topoData){return topojson.feature(topoData, topoData.objects.states).features};
						className = "state "
						break;
					case 'state':
						afterRender = function(){
							var xyz = getXYZ(self.currentFeature.bounds, width, height);
    					self.g.attr("transform", "translate(" + self.projection.translate() + ")scale(" + xyz[2] + ")translate(-" + xyz[0] + ",-" + xyz[1] + ")")
	    					.selectAll(["#countries", "#states", "#cities"])
    						.style("stroke-width", 1.0 / xyz[2] + "px")
    						.selectAll(".city")
    						.attr("d", self.path.pointRadius(10.0 / xyz[2]));
    				}
						filePath = "geodata/" + country + "/" + state + "_cities.topo.json";
						id = "cities";
						features = function(topoData){return topojson.feature(topoData, topoData.objects.cities).features};
						className = "city "
						break;
				}

				d3.json(filePath, function(error, topoData) {
					if (error) return console.error(error);
					beforeRender()
					self.g.select("g").remove();
					self.g.append("g")
						.attr("id", id)
						.selectAll("path")
						.data(features(topoData))
						.enter()
						.append("path")
						.attr("id", function(d) { return d.id || d.properties.name; })
						.attr("class", function(d) { return className + d.id ? fill(getValue(d.id)) : '';  })
						.attr("d", self.path)
						.on("click", self.onClick);
					afterRender();
				});
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
						destination['children'][key] = { "value": newData[key] };
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
			},
		};

		function getXYZ(bounds, width, height){
		  var w_scale = (bounds[1][0] - bounds[0][0]) / width;
		  var h_scale = (bounds[1][1] - bounds[0][1]) / height;
		  var z = .96 / Math.max(w_scale, h_scale);
		  var x = (bounds[1][0] + bounds[0][0]) / 2;
		  var y = (bounds[1][1] + bounds[0][1]) / 2 + (height / z / 6);
		  return [x, y, z];
		};

		function objectsAreEqual(firstObj, secondObj){
			var firstObjKeys = Object.keys(firstObj);
			var secondObjKeys = Object.keys(secondObj);
			var result = true;
			if(firstObjKeys.length !== secondObjKeys.length){ return false }
			for(var i = 0; i < firstObjKeys.length; i++){
				var key = firstObjKeys[i];
				var firstObjVal = firstObj[key],
					secondObjVal = secondObj[key];
				var firstObjValType = typeString(firstObjVal),
					secondObjValType = typeString(secondObjVal);
				if(firstObjValType !== secondObjValType){ result = false; }
				if(['string', 'number', 'boolean'].indexOf(firstObjValType) != -1){
					result = firstObjVal === secondObjVal;
				} else if(['object', 'array'].indexOf(firstObjValType) != -1){
					result = objectsAreEqual(firstObjVal, secondObjVal);
				} else {
					result = false;
				}
				if(result === false){ break; }
			};
			return result;
		};

		function typeString(o) {
		  if (typeof o != 'object')
		    return typeof o;
		  if (o === null)
		      return 'null';
		  //object, array, function, date, regexp, string, number, boolean, error
		  var internalClass = Object.prototype.toString.call(o)
		                                               .match(/\[object\s(\w+)\]/)[1];
		  return internalClass.toLowerCase();
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
		} 
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

// var dataObj = {};

// var choropleth = new Choropleth({
// 	mapSelector: '#map',
// 	dataStore: dataObj, 
// 	onClick: function(selection){
// 		// {zoom: 'state', country: 'USA', state: 'CA'}
// 		if(Choropleth.get(selection)){
// 			Choropleth.render(selection);
// 		} else {
// 			$.ajax.get({
// 				data: selection,
// 				success: function(data){
// 					// data = {'San Francisco': 4, 'Los Angeles': 10, 'San Diego': 3}
// 					Choropleth.insert(data, selection);
// 					Choropleth.render(selection);
// 					otherThing.render();
// 				}
// 			});
// 		};
// 	}
// })
// localstorage: true
// legend: '' 
// hoverTemplate: ''