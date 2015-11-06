var express = require('express');
var router = express.Router();
var pa  = {
  "allentown": {
    "value": 4,
    "lat": 40.613953,
    "long": -75.477791
  },
  "lancaster": {
    "value": 30,
    "lat": 40.0397,
    "long": -76.3044
  },
  "lititz": {
    "value": 8,
    "lat": 40.1547,
    "long": -76.3033
  },
  "york": {
    "value": 1,
    "lat": 39.9628,
    "long": -76.7281
  },
  "philadelphia": {
    "value": 40,
    "lat": 39.9500,
    "long": -75.1667
  },
  "pittsburgh": {
    "value": 25,
    "lat": 40.4397,
    "long": -79.9764
  }
}

router.get('/geodata', function(req, res) {
	console.log(req.query)
	var selection = req.query;
	if(selection.zoom === 'world')
  	res.send({"USA": {"value": 1}, "CAN": {"value": 3}})
  else if(selection.zoom === 'country')
  	res.send({"USA-3527": {"value": 1}, "USA-3530": {"value": 3}, "USA-3520": {"value": 6}, "USA-3540": {"value": 1}, "USA-3541": {"value": 9}})
  else if(selection.zoom === 'state')
    res.send(pa)
  else 
  	res.send({})
});

module.exports = router;