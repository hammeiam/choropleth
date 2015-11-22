var pg = require('pg');
var request = require('request');
var csv = require('csv');
var fs = require('fs');
var connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/choroplethdata';
var googleKey = process.env.GOOGLE_KEY || 'googlekey'

var client = new pg.Client(connectionString);
client.connect();
var createDB = client.query('CREATE TABLE locations (id SERIAL PRIMARY KEY, lat varchar(255), long varchar(255), country varchar(255), state varchar(255), city varchar(255))');

// given a location object from Google Geocoder
// return an object containing the 5 fields we care about
function parseAddress(location){
  var output = {};
  location.address_components.forEach(function(comp){
    if(comp.types.indexOf("country") >= 0){
      output['country'] = comp['long_name']
    } else if (comp.types.indexOf("administrative_area_level_1") >= 0){
      output['state'] = comp['long_name']
    } else if (comp.types.indexOf("locality") >= 0){
      output['city'] = comp['long_name']
    }
  });
  output['lat'] = location['geometry']['location']['lat'];
  output['long'] = location['geometry']['location']['lng'];
  return output;
}

// given the output of the parseAddress function
// return false if the data is incomplete
// or an array of a parameterized sql and corresponding values
function buildInsertSQL(fields){
  var keys = ['lat', 'long', 'country', 'state', 'city'];
  var values = [];
  var valueSubs = []
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if(!fields[key]){ return false; }
    values.push(fields[key]);
    valueSubs.push('$' + (i + 1))
  };
  var sqlString = 'INSERT INTO locations ('; 
  sqlString += keys.join(', '); 
  sqlString += ') VALUES (';
  sqlString += valueSubs.join(', '); 
  sqlString += ');';

  return [sqlString, values];
}

// generic rate limiter, set to 5 requests/sec
var rateLimit = function(fn, context){
  var q = [], interval = 200, timer;

  var processQueue = function(){
    var item = q.shift();
    fn.apply(item.context, item.args);
    if(q.length === 0){
      clearInterval(timer);
      timer = null;
    }
  }

  return function limited(){
    q.push({
      context: context || this,
      args: [].slice.call(arguments)
    })

    if(!timer){
      processQueue(); // immediately process first, then continue with rest
      timer = setInterval(processQueue, interval);
    }
  }
};

var requestFn = rateLimit(function(url, isLast){
  console.log('Requesting ', url)
  request({url: url, encoding: 'utf8'}, function(error, response, body){
    var body = JSON.parse(body);
    console.log('Got response')
    if (error || response.statusCode !== 200) { console.log(error); return false; } // fail on error
    if(!body['results'] || body['results'].length === 0){ console.log('No results'); return false; } // fail on empty results

    var fields = parseAddress(body['results'][0]);
    var queryComponents = buildInsertSQL(fields);
    if(!queryComponents){ return false; } // fail on missing fields in result

    var insertQuery = client.query(queryComponents[0], queryComponents[1]);
    if(isLast){ // close client after last query
      insertQuery.on('end', function() { client.end(); });
    }
  })
})

// build url for google geocoder request
var baseRequestString = "https://maps.googleapis.com/maps/api/geocode/json?";
baseRequestString += "location_type=ROOFTOP";
baseRequestString += "&language=en";
baseRequestString += "&key=" + googleKey;
var latLong, url;

// parse csv. For each location, query the geocoder, store result in DB
fs.readFile('private/locationLatLongs.csv', function(err, file){
  csv.parse(file.toString(), function(err,output){
    for(var i = 0; i < output.length; i++){
      console.log('Looking at ', i)
      latLong = output[i][0] + ',' + output[i][1];
      url = baseRequestString + "&latlng=" + latLong;
      requestFn(url, i === output.length - 1);
    }
  })
})

