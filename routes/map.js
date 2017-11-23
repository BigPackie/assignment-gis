var express = require('express');
var router = express.Router();
var db = require('../public/javascripts/db');
var toGeoJSON = require('../public/javascripts/postgistogeojson.js');
var queryBuilder = require('../public/javascripts/queryBuilder');

/* GET map page. */
router.get('/', function(req, res, next) {
    res.render('map',{
        title: "Eat&Look",
        aditionalParam: "someParam"
    });
});

/* GET users listing. */
router.get('/getUser', function(req, res, next) {
    console.log("connection to db");
    console.log("connected");
    var query = db.query("SELECT * FROM public.spatial_ref_sys LIMIT 1",function(err, result) {
        var columnCount = Object.keys(result.rows[0]).length;
        res.send('Performer query ' + columnCount + ' Content:' + JSON.stringify(result));
    });;
    /* query.on("row", function (row, result) {
         result.addRow(row);
     });
     query.on("end", function (result) {
         res.send(result.rows[0]);
         res.end();
     });*/
    //res.send('This is mypage upgraded');
});


/* GET users listing. */
router.get('/getUsers', function(req, res, next) {
    console.log("connection to db in map");
    var query = db.query("SELECT * FROM public.spatial_ref_sys",function(err, result) {
        //var qResult = JSON.stringify(result);
        var title = 'this is an awesome map';
        res.json(result);
    });
});



router.get('/getS', function(req, res, next) {
    console.log("query on gis db");
    var response = "";
    var query = db.query(" SELECT point.name,point.natural, ST_AsGeoJSON(way) AS geojson from planet_osm_point point where name = 'studnička pod Poľanou';;",function(err, result) {
        console.log("result from db:" + JSON.stringify(result));
        if(!result.rowCount){
            console.log("Returned result contains no rows");
        }
        //var qResult = JSON.stringify(result);
        var geoJSON = toGeoJSON(result.rows); //if rowCount from db result is 0, geoJSON object will have prop "features":[] , empty array
        console.log("geoJSON:" + JSON.stringify(geoJSON));
        //res.send(geoJSON);
        res.json(geoJSON);
    });
});

router.get('/getAllRestaurants',function (req, res, next) {
    console.log("query on gis db");
    var response = "";
    var query = db.query("SELECT point.name,ST_AsGeoJSON(point.way) AS geojson \n" +
                         "FROM public.planet_osm_point point\n" +
                         "WHERE point.amenity = 'restaurant' AND point.name IS NOT NULL LIMIT 300;",function(err, result) {
        console.log("result from db:" + JSON.stringify(result));
        if(!result.rowCount) {
            console.log("Returned result contains no rows");
        }
        var geoJSON = toGeoJSON(result.rows); //if rowCount from db result is 0, geoJSON object will have prop "features":[] , empty array
        console.log("geoJSON:" + JSON.stringify(geoJSON));
        //res.send(geoJSON);
        res.json(geoJSON);
    });
});

router.get('/getGreen',function (req, res, next) {
    console.log("query on gis db");
    var response = "";
    var query = db.query("select ST_AsGeoJSON(way) as geojson from planet_osm_polygon poly\n" +
        "        where poly.landuse='meadow' "
     ,function(err, result) {

        if(!result.rowCount) {
            console.log("Returned result contains no rows");
        }else{
            console.log("result from db:" + result.rowCount);
        }
        var geoJSON = toGeoJSON(result.rows); //if rowCount from db result is 0, geoJSON object will have prop "features":[] , empty array
       // console.log("geoJSON:" + JSON.stringify(geoJSON));
        //res.send(geoJSON);
        res.json(geoJSON);
    });
});


router.get('/getCityLocation',function (req, res, next) {
    console.log("query on gis db");
    console.log("Request params" + JSON.stringify(req.query));
    var response = "";
    if(!req.query.data){
        res.json(response);
        return;
    }
    var query = db.query("SELECT name,ST_AsGeoJSON(way)as geojson FROM planet_osm_point point\n" +
                        "WHERE LOWER(point.name) ILIKE('%"+req.query.data+"%')and point.place IN ('city','town') LIMIT 1;",function(err, result) {
        console.log("result from db:" + JSON.stringify(result));
        if(!result.rowCount) {
            console.log("Returned result contains no rows");
            res.json(response);
            return;
        }
        var geoJSON = toGeoJSON(result.rows); //if rowCount from db result is 0, geoJSON object will have prop "features":[] , empty array
        console.log("geoJSON:" + JSON.stringify(geoJSON));
        //res.send(geoJSON);
        res.json(geoJSON);
    });
});

router.get('/getRestaurantsByCity',function (req, res, next) {
    console.log("Request params" + JSON.stringify(req.query));
    var response = "";
    if(!req.query){
        console.log("Request params empty, ending request.");
        res.json(response);
        return;
    }

    var parametersFirst = {
        city :req.query.city,
    };
    console.log("parametersFirst:" + JSON.stringify(parametersFirst));

    var queryStringFirst = queryBuilder.buildQuery_getCity(parametersFirst.city);
    console.log("query: " + queryStringFirst);
    if(!queryStringFirst){
        console.log("Query not built, probably invalid input params");
        res.json(response);
        return;
    }

    db.query(queryStringFirst, function(errFirst, resultFirst) {
        if(!resultFirst.rowCount) {
            console.log("Returned result contains no rows");
            res.json(response);
            return;
        }
        console.log("Result row count:" + JSON.stringify(resultFirst.rowCount));

        var geoCity = toGeoJSON(resultFirst.rows);
        console.log("geoCity:" + JSON.stringify(geoCity));

        var parameters = {
            point : {
                long : geoCity.features[0].geometry.coordinates[0],
                lat : geoCity.features[0].geometry.coordinates[1],
            },
            nature : processNature(req.query.nature)
        }
        console.log("parameters:" + JSON.stringify(parameters));

        var queryString = queryBuilder.buildQuery_getRestaurantsByPointByNature(parameters.point,parameters.nature);
        console.log("query: " + queryString);
        if(!queryString){
            console.log("Query not built, probably invalid input params");
            res.json(response);
            return;
        }

        db.query(queryString, function(err, result) {
            if(!result.rowCount) {
                console.log("Returned result contains no rows");
                res.json(response);
                return;
            }
            console.log("Result row count:" + JSON.stringify(result.rowCount));


            response = {
                city: geoCity,
                restaurants : toGeoJSON(result.rows) //if rowCount from db result is 0, geoJSON object will have prop "features":[] , empty array
            }
            res.json(response);

        });
    });
});

router.get('/getRestaurantsByPoint',function (req, res, next) {
    console.log("Request params" + JSON.stringify(req.query));
    var response = "";
    if(!req.query){
        console.log("Request params empty, ending request.");
        res.json(response);
        return;
    }

     var parameters = {
         point : processPoint(req.query.point),
         nature : processNature(req.query.nature)
     };
    console.log("parameters:" + JSON.stringify(parameters));

     var queryString = queryBuilder.buildQuery_getRestaurantsByPointByNature(parameters.point,parameters.nature);


  //for testing
/*
    var point = {lat: 48.152799, long: 17.116507};
    var nature = {water:true, green:false};
    var queryString = queryBuilder.buildQuery_getRestaurantsByPointByNature(point, nature);
*/

    console.log("query: " + queryString);
    if(!queryString){
        console.log("Query not built, probably invalid input params");
        res.json(response);
        return;
    }

    db.query(queryString, function(err, result) {
        if(!result.rowCount) {
            console.log("Returned result contains no rows");
            res.json(response);
            return;
        }
        console.log("Result row count:" + JSON.stringify(result.rowCount));

        response = {
            restaurants : toGeoJSON(result.rows)  //if rowCount from db result is 0, geoJSON object will have prop "features":[] , empty array
        };
        res.json(response);
    });
});


router.get('/getPumps',function (req, res, next) {
    console.log("Request params" + JSON.stringify(req.query));
    var response = "";


    if(!req.query){
        console.log("Request params empty, ending request.");
        res.json(response);
        return;
    }

/*
    var parameters = {
        start : {lat: 48.152799, long: 17.116507},
        end :{lat: 48.308265, long: 18.081142}
    };*/

    var parameters = {
        start : processPoint(req.query.start),
        end : processPoint(req.query.end)
    };
    console.log("parameters:" + JSON.stringify(parameters));

    var queryString = queryBuilder.buildQuery_getPumps(parameters.start,parameters.end);

    console.log("query: " + queryString);
    if(!queryString){
        console.log("Query not built, probably invalid input params");
        res.json(response);
        return;
    }

    db.query(queryString, function(err, result) {
        if(!result.rowCount) {
            console.log("Returned result contains no rows");
            res.json(response);
            return;
        }
        console.log("Result row count:" + JSON.stringify(result.rowCount));

        response = {
            pumps : toGeoJSON(result.rows)  //if rowCount from db result is 0, geoJSON object will have prop "features":[] , empty array
        };
        res.json(response);
    });
});


router.get('/getNatureByPoint',function (req, res, next) {
    console.log("Request params" + JSON.stringify(req.query));
    var response = "";
    if(!req.query){
        console.log("Request params empty, ending request.");
        res.json(response);
        return;
    }

    var parameters = {
        point : processPoint(req.query.point),
        nature : {water:true, green:true}
    };
    console.log("parameters:" + JSON.stringify(parameters));

    var queryString = queryBuilder.buildQuery_getNatureByPoint(parameters.point,parameters.nature);

    console.log("query: " + queryString);
    if(!queryString){
        console.log("Query not built, probably invalid input params");
        res.json(response);
        return;
    }

    db.query(queryString,function(err, result) {
           if(!result.rowCount) {
               console.log("Returned result contains no rows");
               res.json(response);
               return;
           }
           console.log("Result row count:" + JSON.stringify(result.rowCount));

           response = {
               nature : toGeoJSON(result.rows)  //if rowCount from db result is 0, geoJSON object will have prop "features":[] , empty array
           };
           res.json(response);
        });
});




//hellpers methods

var processPoint = function(point){
    if(point && point.lat && point.long){
        console.log("converting to number");
        return {
            lat:Number(point.lat),
            long:Number(point.long)
        }
    }
}

var processNature = function (nature) {
    if(nature){
        console.log("converting to boolean");

        return {
            water: nature.indexOf("water") > -1,
            green: nature.indexOf("green") > -1
        }
    }
}


module.exports = router;
