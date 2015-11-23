var express = require('express');
var router = express.Router();
var pg = require('pg');
var connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/choroplethdata';
var client = new pg.Client(connectionString);

// var pa  = {
//   "allentown": {
//     "value": 4,
//     "lat": 40.613953,
//     "long": -75.477791
//   },
//   "lancaster": {
//     "value": 30,
//     "lat": 40.0397,
//     "long": -76.3044
//   },
//   "lititz": {
//     "value": 8,
//     "lat": 40.1547,
//     "long": -76.3033
//   },
//   "york": {
//     "value": 1,
//     "lat": 39.9628,
//     "long": -76.7281
//   },
//   "philadelphia": {
//     "value": 40,
//     "lat": 39.9500,
//     "long": -75.1667
//   },
//   "pittsburgh": {
//     "value": 25,
//     "lat": 40.4397,
//     "long": -79.9764
//   }
// }

router.get('/geodata', function(req, res) {
  var selection = req.query;
  var output = {};
  var query;
  client.connect(function(err) {
    if(err) {
      return console.error('could not connect to postgres', err);
    } else {
      console.log(req.query)
      if(selection.zoom === 'world')
        query = client.query("select count(id),country from locations group by country");
        // res.send({"USA": {"value": 1}, "CAN": {"value": 3}})
      else if(selection.zoom === 'country')
        query = client.query("select count(id),state from locations where country=$1 group by state", [selection.country.name]);
        // res.send({"USA-3527": {"value": 1}, "USA-3530": {"value": 3}, "USA-3520": {"value": 6}, "USA-3540": {"value": 1}, "USA-3541": {"value": 9}})
      else if(selection.zoom === 'state')
        query = client.query("select count(id),city,lat,long from locations where country=$1 and state=$2 group by city", [selection.country.name, selection.state.name]);
        // res.send(pa)
      else 
        res.send({})

      query.on('row', function(row){
        console.log(row)
        var item = {},
          id;
        if(selection.zoom === 'world'){
          id = row.country;
        } else if(selection.zoom === 'country'){
          id = row.state;
        } else if(selection.zoom === 'state'){
          id = row.city;
          item['lat'] = row.lat;
          item['long'] = row.long;
        }
        item['value'] = row.count;
        output[id] = item;
      })

      query.on('end', function(){
        client.end();
        res.json(output);
      })
    }
  });
	
});

module.exports = router;