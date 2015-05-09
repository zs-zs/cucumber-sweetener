# cucumber-sweetener

A small extension for [cucumber-js](https://github.com/cucumber/cucumber-js) that sweetens your steps with promises and timeouts. No more callbacks!

## Sweet as a cucumber

Without cucumber-sweetener, you have to handle callbacks manually, even if you use an API which returns promises:

```javascript
this.Then(/^the user '([^']*)' and the user '([^']*)' should be connected$/, 
function(id1, id2, callback) {
	var user1 = this.getUser(id1).waitForConnection();
	var user2 = this.getUser(id2).waitForConnection();
	q.all([user1, user2]).then(function() {
		callback();
	}).fail(function(error) {
		callback.fail(error);
	});
});
```

With sweet steps, if you don't want to call your callbacks manually, you don't have to. 
You can simply return a promise - this extension will call the appropriate callbacks for you:

```javascript
Then(/^the user '([^']*)' and the user '([^']*)' should be connected$/, function(id1, id2) {
	var user1 = this.getUser(id1).waitForConnection();
	var user2 = this.getUser(id2).waitForConnection();
	return q.all([user1, user2]);
});
```

What happens when a promise will not be resolved? With pure cucumber-js, the execution would hang infinitely.
With sweet steps, you can specify a timeout for the step execution time if you want:

```javascript
Then(/^the user '([^']*)' and the user '([^']*)' should be connected$/, function(id1, id2) {
  ...
}, {timeout: 5000}); // No more hanging tests! After 5 seconds this step would fail.
```

## Installation

Install it with npm:

	npm install cucumber-sweetener

## Usage

Create a JavaScript file as a [support file](https://github.com/cucumber/cucumber-js#support-files) under the `support` subfolder. Files under the `support` subfolder are always loaded first by cucumber-js. So if you load this extension here, you can use the sweet steps throughout your project.
For example if you have a support file containing your event hooks, you can insert the following code to setup cucumber-sweetener:

```javascript
var sweetener = require('cucumber-sweetener');

var eventHooks = function () {
  sweetener.sweeten(this, {timeout: 1000});// global timeout for steps where are no timeout
  
  // after you called .sweeten(), you can use the supported sweetened steps
  After(function() {
    return this.somePromise();
	}, {timeout: 4000});
}
```

## Supported steps

- Given, When, Then
- Before, After
