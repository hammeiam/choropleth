var express = require('express');
var router = express.Router();
var pa  = {
  "allentown": {
    "value": 4,
    "lat": 40.613953,
    "long": -75.477791
  },
  "lancaster": {
    "value": 16,
    "lat": 40.0397,
    "long":76.3044
  },
  "york": {
    "value": 14,
    "lat": 39.9628,
    "long": 76.7281
  },
  "philadelphia": {
    "value": 40,
    "lat": 39.9500,
    "long": 75.1667
  },
  "pittsburgh": {
    "value": 25,
    "lat": 40.4397,
    "long": 79.9764
  }
}

/* GET users listing. */
router.get('/', function(req, res) {
	console.log('rendering index')
	res.render('index', { 
		title: 'Map'
	});
  
});

router.get('/geodata', function(req, res) {
	console.log(req.query)
	var selection = req.query;
	if(selection.zoom === 'world')
  	res.send({"USA": 1, "CAN": 3})
  else if(selection.zoom === 'country')
  	res.send({"USA-3527": 1, "USA-3530": 3, "USA-3520": 6, "USA-3540": 2, "USA-3541": 9})
  else if(selection.zoom === 'state')
    res.send(pa)
  else 
  	res.send({})
});

module.exports = router;