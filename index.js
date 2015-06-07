'use strict';

var bunyan = require('bunyan');

var log = bunyan.createLogger({
	name: 'Sweetener',
	level: 'info',
	streams: [{path: 'sweetener.log'}]
});

var featureName, scenarioName, stepName;
var defaultGlobalTimeout = 1000;

function getTimeoutOpts(stepTimeoutOpts, defaultTimeout) {
	var t = stepTimeoutOpts || {timeout: defaultTimeout};
	if(typeof t.timeout !== 'number') {
		throw new Error('The step timeout must be a number, ' + t.timeout + ' is not a number!');
	}
	return t;
}

function ensureTimeoutCleared(timeoutId) {
	if(timeoutId) {
		clearTimeout(timeoutId);
	}
}

function createTimeoutCallback(callback, timeoutOpts) {
	var timeoutId,
		isCallbackCalled = false;

	var ensureCallbackCalled = function(f, self, args) {
		if(!isCallbackCalled) {
			isCallbackCalled = true;
			f.call(self, args);
		}
	};

	var wrappedCallback = function() {
		ensureTimeoutCleared(timeoutId);
		ensureCallbackCalled(callback);
	};
	wrappedCallback.fail = function(err) {
		ensureTimeoutCleared(timeoutId);
		ensureCallbackCalled(callback.fail, callback, err);
	};
	wrappedCallback.pending = function() {
		ensureTimeoutCleared(timeoutId);
		ensureCallbackCalled(callback.pending, callback);
	};

	timeoutId = setTimeout(function() {
		var message = 'Timeout of ' + timeoutOpts.timeout + ' milliseconds was exceeded, scenario will fail.';
		log.info(message + ' In step: "' + stepName + '"');
		ensureCallbackCalled(callback.fail, callback, message);
	}, timeoutOpts.timeout);

	return wrappedCallback;
}

function wrapWithTimeout(body, timeoutOpts) {
	return function() {
		var args = Array.prototype.slice.call(arguments);
		var wrappedCallback = createTimeoutCallback(args[args.length - 1], timeoutOpts);
		args[args.length - 1] = wrappedCallback;

		var retval;

		try {
			log.info(stepName + ' started (Feature: "' + featureName + '", Scenario: "' + scenarioName + '")');
			retval = body.apply(this, args);
			log.info(stepName + ' ended (Feature: "' + featureName + '", Scenario: "' + scenarioName + '")');
		} catch (err) {
			wrappedCallback.fail(err);
			return undefined;
		}
		if (args.length === body.length) {
			return retval;
		}
		if (retval && retval.then) {
			retval.then(function() {
				return wrappedCallback();
			}, function(err) {
				return wrappedCallback.fail(err);
			});
			return undefined;
		}
		return wrappedCallback();
	};
}

function wrapScenarioStep(defineStep, globalOptions) {
	globalOptions = globalOptions || {};
	globalOptions.timeout = typeof globalOptions.timeout === 'number' ? globalOptions.timeout : defaultGlobalTimeout;

	return function(pattern, body, timeoutOpts) {
		if(!Array.isArray(pattern)) {
			defineStep(pattern, wrapWithTimeout(body, getTimeoutOpts(timeoutOpts, globalOptions.timeout)));
			return;
		}

		//array of patterns:
		pattern.forEach(function(p) {
			defineStep(p, wrapWithTimeout(body, getTimeoutOpts(timeoutOpts, globalOptions.timeout)));
		});
	};
}

function wrapHook(defineStep, globalOptions) {
	globalOptions = globalOptions || {};
	globalOptions.timeout = typeof globalOptions.timeout === 'number' ? globalOptions.timeout : defaultGlobalTimeout;

	return function() {
		var timeoutOpts = Array.prototype.pop.call(arguments);
		var body = Array.prototype.pop.call(arguments);

		var wrappedFunction = wrapWithTimeout(body, getTimeoutOpts(timeoutOpts, globalOptions.timeout));
		var newParams = Array.prototype.slice.call(arguments);
		newParams.push(wrappedFunction);

		return defineStep.apply(this, newParams);
	};
}

module.exports.sweeten = function (context, opts) {
	if(opts.logger) {
		log = opts.logger;
	}

	global.Given = global.When = global.Then = wrapScenarioStep(context.defineStep, opts);
	global.After = wrapHook(context.After, opts);
	global.Before = wrapHook(context.Before, opts);

	context.BeforeFeature(function (event, callback) {
		featureName = event.getPayloadItem('feature').getName();
		callback();
	});

	context.BeforeScenario(function (event, callback) {
		scenarioName = event.getPayloadItem('scenario').getName();
		callback();
	});

	context.BeforeStep(function (event, callback) {
		stepName = event.getPayloadItem('step').getName();
		callback();
	});
};
