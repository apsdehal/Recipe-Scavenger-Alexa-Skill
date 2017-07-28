var Alexa = require('alexa-sdk');
var http = require('http');

var states = {
    RECOMMENDATION: '_RECOMMENDATION'
};


var numberOfResults = 3;

var welcomeMessage = "Welcome to Recipe Scavenger. I can tell you recipes based on your preferences and what you have with you. What will it be?";

var welcomeRepromt = "You can ask me for recipes based on what you have, or you can ask me what is popular nearby. What will it be?";

var HelpMessage = "Here are some things you  can say: I am hungry. Let's cook. What would you like to do?";

var tryAgainMessage = "please try again."

var goodbyeMessage = "OK, have a nice time.";

var recommendations = "These are the " + numberOfResults + " recipes based on the ingredients and preferences you provided. ";

var newline = "\n";

var output = "";

var alexa;

var newSessionHandlers = {
    'LaunchRequest': function () {
        this.handler.state = states.RECOMMENDATION;
        output = welcomeMessage;
        this.emit(':ask', output, welcomeRepromt);
    },
    'getRecommendations': function () {
        this.handler.state = states.RECOMMENDATION;
        this.emitWithState('getRecommendations');
    },
    'getCuisines': function () {
        this.handler.state = states.RECOMMENDATION;
        this.emitWithState('getCuisines');
    },
    'getInfoForRecommendations': function () {
        this.handler.state = states.RECOMMENDATION;
        this.emitWithState('getInfoForRecommendations');
    },
    'finishRecommendationsIntent': function () {
        this.handler.state = states.RECOMMENDATION;
        this.emitWithState('finishRecommendations');
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', goodbyeMessage);
    },
    'AMAZON.CancelIntent': function () {
        // Use this function to clear up and save any data needed between sessions
        this.emit(":tell", goodbyeMessage);
    },
    'SessionEndedRequest': function () {
        // Use this function to clear up and save any data needed between sessions
        this.emit('AMAZON.StopIntent');
    },
    'Unhandled': function () {
        output = HelpMessage;
        this.emit(':ask', output, welcomeRepromt);
    },
};

var recommendationsHandler = Alexa.CreateStateHandler(states.RECOMMENDATION, {

    'getRecommendations': function () {
        output = 'Ok, I will start collecting your ingredients and preferences now. To stop at any point, you can say,' + 
        ' that\'s it or stop. Now, please tell me what ingredients you have';
        this.attributes.recommendationsStarted = true;
        this.emit(':ask', output, tryAgainMessage);
    },
    'finishRecommendationsIntent': function () {
        if (this.attributes.fromIngredients) {
            this.attributes.fromIngredients = false;
            this.emit(':ask', "Will you want to add a cuisine type? If yes, say cuisine's name, otherwise say no");
        } else {
            this.emitWithState('finishRecommendations');  
        }
    },
   'getCuisines': function () {
        console.log("Reached cuisine handler");
        var slotValue = '';
        if(this.event.request.intent.slots.cuisine) {
            if (this.event.request.intent.slots.cuisine) {
                slotValue = this.event.request.intent.slots.cuisine.value;
                this.attributes.cuisine = slotValue;
            }
            this.handler.state = states.RECOMMENDATION;
            this.emitWithState('finishRecommendations');
        } else {
            this.emit(':tell', tryAgainMessage);
        }
    },
    'finishRecommendations': function () {
        console.log('Reached finish');
        var ingredients = this.attributes.ingredients ? this.attributes.ingredients.join(',') : '';
        var cuisine = this.attributes.cuisine;
        var that = this;

        if (ingredients.length === 0) {
            if (this.attributes.recommendationsStarted) {
                this.attributes.recommendationsStarted = false;
                this.emit(":tell", "No ingredients were provided, so not recommending any recipes. Have a nice time");                
            } else {
                this.emit(":tell", goodbyeMessage);
            }
            return;
        }
        httpGet(ingredients, cuisine, function (response) {
            console.log(response);
            ingredients = ingredients.split(',');
            if (ingredients.length == 0) {
                alexa.emit(":tell", "No ingredients");
                return;
            }

            var finalIngredients = ingredients[0];
            var i = 1;
            for(i = 1; i < ingredients.length - 1; i++) {
                finalIngredients += ingredients[i] + ", ";
            }  

            if (ingredients.length >= 2) {
                finalIngredients += " and " + ingredients[i];
            }

            var output = 'You gave me ' + finalIngredients + '. Let me see what I can get. ';

            // Parse the response into a JSON object ready to be formatted.
            var responseData = JSON.parse(response);
            var cardContent = "Here are recommendations for you\n\n";

            // Check if we have correct data, If not create an error speech out to try again.
            if (responseData == null) {
                output = "There was a problem with getting data please try again";
            } else if (responseData.results.length == 0) {
                output = "Sorry I couldn't find any results";
            }
            else {
                if (numberOfResults > responseData.results.length) {
                    numberOfResults = responseData.results.length;
                }

                output += recommendations;
                // If we have data.
                for (var i = 0; i < responseData.results.length; i++) {

                    if (i < numberOfResults) {
                        // Get the name and description JSON structure.
                        var headline = responseData.results[i].title;
                        var index = i + 1;

                        output += " Recommendation " + index + ": " + headline.replace("\n", "").trim() + ". ";

                        cardContent += " Recommendation " + index + ".\n";
                        cardContent += headline + ".\n\n";
                    }
                }
            }

            output = output.replace(/\r?\n|\r/g, " ").trim();
            output = output.replace("&", "and").trim();
            var cardTitle =  "Recipes";
            console.log(that.event.request.intent.name + output);
            that.attributes.recommendationsStarted = false;
            alexa.emit(':tell', output);
        });
    },
    'getInfoForRecommendations': function () {
        if(this.event.request.intent.slots.ingredient) {
            if (this.event.request.intent.slots.ingredient.value) {
                var slotValue = this.event.request.intent.slots.ingredient.value;
                this.attributes.ingredients = this.attributes.ingredients || [];
                this.attributes.ingredients.push(slotValue);
            }
            this.attributes.fromIngredients = true;
            this.emit(':ask', 'Do you have any more? If you say no, we will select cuisine next.', tryAgainMessage);
        } else {
            this.emit(':tell', tryAgainMessage);
        }

    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', goodbyeMessage);
    },
    'AMAZON.HelpIntent': function () {
        output = HelpMessage;
        this.emit(':ask', output, HelpMessage);
    },

    'AMAZON.CancelIntent': function () {
        // Use this function to clear up and save any data needed between sessions
        this.emit(":tell", goodbyeMessage);
    },
    'Unhandled': function () {
        output = HelpMessage;
        this.emit(':ask', output, welcomeRepromt);
    }

});

exports.handler = function (event, context, callback) {
    alexa = Alexa.handler(event, context);
    alexa.registerHandlers(newSessionHandlers, recommendationsHandler);
    alexa.execute();
};

// Create a web request and handle the response.
function httpGet(param1, param2, callback) {
    var path = '/api/?i=' + param1;
    if (param2 && param2.length) {
        path += '&q=' + param2;
    }
    console.log(path);
    var options = {
        host: 'www.recipepuppy.com',
        path: path,
        method: 'GET'
    };

    var req = http.request(options, (res) => {

        var body = '';

        res.on('data', (d) => {
            body += d;
        });

        res.on('end', function () {
            callback(body);
        });

    });
    req.end();

    req.on('error', (e) => {
        console.error(e);
    });
}
