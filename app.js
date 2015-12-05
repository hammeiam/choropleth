var express = require('express');
var app = express();
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var pg = require('pg');
var connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/choroplethdata';
var client = new pg.Client(connectionString);

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.get('/geodata', function(req, res) {
  var selection = req.query;
  var output = {};
  var query, sqlString;
  pg.connect(connectionString, function(err, client, done) {
    if(err) {
      return console.error('could not connect to postgres', err);
    } else {
      console.log(req.query)
      if(selection.zoom === 'world'){
        sqlString = "select count(id), country ";
        sqlString += "from locations ";
        sqlString += "group by country"
        query = client.query(sqlString);

      } else if(selection.zoom === 'country'){
        sqlString = "select count(id), state ";
        sqlString += "from locations ";
        sqlString += "where country=$1 ";
        sqlString += "group by state"
        query = client.query(sqlString, [selection.country.name]);

      } else if(selection.zoom === 'state'){
        sqlString = "select agg_table.count, locations.city, round(avg(lat),8) as lat, round(avg(long),8) as long " 
        sqlString += "from locations ";
        sqlString += "join (select count(id) as count, city "; 
        sqlString += "from locations "; 
        sqlString += "where country=$1 "; 
        sqlString += "and state=$2 ";
        sqlString += "group by city) agg_table "; 
        sqlString += "on agg_table.city = locations.city ";
        sqlString += "group by locations.city, agg_table.count";
        query = client.query(sqlString, [selection.country.name, selection.state.name]);

      } else 
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
        done();
        res.json(output);
      })
    }
  })
});

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});