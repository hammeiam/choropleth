var express = require('express');
var router = express.Router();


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
  else 
  	res.send({})
});

module.exports = router;