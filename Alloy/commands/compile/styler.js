var fs = require('fs'),
	path = require('path'),
	_ = require('../../lib/alloy/underscore')._
	U = require('../../utils'),
	CU = require('./compilerUtils'),
	optimizer = require('./optimizer'),
	grammar = require('../../grammar/tss'),
	logger = require('../../common/logger'),
	CONST = require('../../common/constants');

// constants
var STYLE_ALLOY_TYPE = '__ALLOY_TYPE__';
var STYLE_EXPR_PREFIX = exports.STYLE_EXPR_PREFIX = '__ALLOY_EXPR__--';
var STYLE_REGEX = /^\s*([\#\.]{0,1})([^\[]+)(?:\[([^\]]+)\])*\s*$/;
var EXPR_REGEX = new RegExp('^' + STYLE_EXPR_PREFIX + '(.+)');
var BINDING_REGEX = /^\{(.+)\}$/;
var VALUES = {
	ID:     100000,
	CLASS:   10000,
	API:      1000,
	PLATFORM:  100,
	FORMFACTOR: 10,
	SUM:         1,
	THEME:       0.9,
	ORDER:       0.0001
};

// private variables
var styleOrderCounter = 1;
var platform;

exports.setPlatform = function(p) {
	platform = p;
};

/*
 * @property {Array} globalStyle
 * The global style array, which contains an merged, ordered list of all 
 * applicable global styles. This will serve as the base for all controller-
 * specific styles.
 *
 */
exports.globalStyle = [];

/*
 * @property {Object} bindingsMap
 * Holds the collection of models/collections data-bound to UI component 
 * properties in the Alloy app. This map is used to create the most effecient
 * set of event listeners possible for dynamically updating the UI based on 
 * changes to the data model/collections.
 *
 */
exports.bindingsMap = {};

/*
 * @method loadGlobalStyles
 * Loads all global styles (app.tss) in a project and sorts them appropriately. 
 * The order of sorting is as follows:
 *
 * 1. global
 * 2. global theme
 * 3. global platform-specific
 * 4. global theme platform-specific
 * 
 * This function does not return a result, but instead updates the global style
 * array that will be used as a base for all controller styling. This is 
 * executed before any other styling is performed during the compile phase.
 *
 * @param {String} Full path to the "app" folder of the target project
 * @param {String} The mobile platform for which to load styles
 * @param {Object} [opts] Additional options
 */
exports.loadGlobalStyles = function(appPath, opts) {
	// reset the global style array
	exports.globalStyle = [];

	// validate/set arguments
	opts || (opts = {});
	var theme = opts.theme;
	var apptss = CONST.GLOBAL_STYLE;
	var stylesDir = path.join(appPath,CONST.DIR.STYLE);
	if (theme) {
		var themesDir = path.join(appPath,'themes',theme,CONST.DIR.STYLE);
	}

	// create array of global styles to load based on arguments
	var loadArray = [];
	loadArray.push({ 
		path: path.join(stylesDir,apptss),
		msg: apptss
	});
	theme && loadArray.push({ 
		path: path.join(themesDir,apptss),
		msg: apptss + '(theme:' + theme + ')',
		obj: { theme: true }
	});
	loadArray.push({ 
		path: path.join(stylesDir,platform,apptss),
		msg: apptss + '(platform:' + platform + ')',
		obj: { platform: true }
	});
	theme && loadArray.push({ 
		path: path.join(themesDir,platform,apptss),
		msg: apptss + '(theme:' + theme + ' platform:' + platform + ')',
		obj: { platform: true, theme: true }
	});

	// load & merge each global style file to update the global style array 
	_.each(loadArray, function(g) {
		if (path.existsSync(g.path)) {
			logger.info('[' + g.msg + '] global style processing...');
			exports.globalStyle = exports.loadAndSortStyle(g.path, _.extend(
				{ existingStyle: exports.globalStyle }, 
				g.obj || {}
			));
		}
	});	

	styleOrderCounter++;
}

/*
 * @method sortStyles
 * Given a parsed style from loadStyle(), sort all the style entries into an 
 * ordered array. This is the final operations to prepare a style for usage with 
 * a Titanium UI component in Alloy.
 *
 * @param {Object} Parsed style object from a loadStyle() call
 * @param {Object} [opts] Options for this function
 */
exports.sortStyles = function(style, opts) {
	var sortedStyles = [];
	opts || (opts = {});

	if (_.isObject(style) && !_.isEmpty(style)) {
		for (var key in style) {
			var obj = {};
			var priority = styleOrderCounter++ * VALUES.ORDER;
			var match = key.match(STYLE_REGEX);
			if (match === null) {
				U.die('Invalid style specifier "' + key + '"');
			}
			var newKey = match[2];

			// skip any invalid style entries
			if (newKey === 'undefined' && !match[1]) { continue; }

			// get the style key type
			switch(match[1]) {
				case '#':
					obj.isId = true;
					priority += VALUES.ID;
					break;
				case '.':
					obj.isClass = true;
					priority += VALUES.CLASS;
					break;
				default:
					if (match[2]) {
						obj.isApi = true;
						priority += VALUES.API;
					}
					break;
			}

			if (match[3]) {
				obj.queries = {};
				_.each(match[3].split(/\s+/), function(query) {
					var parts = query.split('=');
					var q = U.trim(parts[0]);
					var v = U.trim(parts[1]);
					if (q === 'platform') {
						priority += VALUES.PLATFORM + VALUES.SUM;
						v = v.split(',');
					} else if (q === 'formFactor') {
						priority += VALUES.FORMFACTOR + VALUES.SUM;
					} else {
						priority += VALUES.SUM;
					}
					obj.queries[q] = v;
				});
			} 

			_.extend(obj, {
				priority: priority + (opts.platform ? VALUES.PLATFORM : 0) + (opts.theme ? VALUES.THEME : 0),
				key: newKey, 
				style: style[key]
			});
			sortedStyles.push(obj);
		}
	}

	var theArray = opts.existingStyle ? opts.existingStyle.concat(sortedStyles) : sortedStyles;
	return _.sortBy(theArray, 'priority');
}

exports.loadStyle = function(tssFile) {
	if (path.existsSync(tssFile)) {
		// read the style file
		try {
			var contents = fs.readFileSync(tssFile, 'utf8');
		} catch (e) {
			U.die('Failed to read style file "' + tssFile + '"', e);
		}

		// skip if the file is empty
		if (/^\s*$/gi.test(contents)) {
			return {};
		}

		// Add enclosing curly braces, if necessary
		contents = /^\s*\{[\s\S]+\}\s*$/gi.test(contents) ? contents : '{\n' + contents + '\n}';
			
		// Process tss file then convert to JSON
		try {
			var json = grammar.parse(contents);
			optimizer.optimizeStyle(json);
		} catch (e) {
			U.die([
				'Error processing style "' + tssFile + '"',
				e.message,
				/Expected bare word\, comment\, end of line\, string or whitespace but ".+?" found\./.test(e.message) ? 'Do you have an extra comma in your style definition?' : '',
				'- line:    ' + e.line,
				'- column:  ' + e.column,
				'- offset:  ' + e.offset 
			]);
		}

		return json;
	}
	return {};
};

exports.loadAndSortStyle = function(tssFile, opts) {
	return exports.sortStyles(exports.loadStyle(tssFile), opts);
}

exports.createVariableStyle = function(keyValuePairs, value) {
	var style = {};

	if (!_.isArray(keyValuePairs)) {
		keyValuePairs = [[keyValuePairs, value]];
	}
	_.each(keyValuePairs, function(pair) {
		var k = pair[0];
		var v = pair[1];
		style[k] = { value:v };
		style[k][STYLE_ALLOY_TYPE] = 'var';
	});
	return style;
};

exports.generateStyleParams = function(styles,classes,id,apiName,extraStyle,theState) {
	var regex = EXPR_REGEX,
		bindingRegex = BINDING_REGEX,
		styleCollection = [],
		lastObj = {};

	// don't add an id to the generated style if we are in a local state
	if (theState && theState.local) {
		delete extraStyle.id;
	}

	// process all style items, in order
	_.each(styles, function(style) {
		var styleApi = style.key;
		if (style.isApi && styleApi.indexOf('.') === -1) {
			var ns = (CONST.IMPLICIT_NAMESPACES[styleApi] || CONST.NAMESPACE_DEFAULT);
			styleApi = ns + '.' + styleApi;
		}

		if ((style.isId && style.key === id) ||
			(style.isClass && _.contains(classes, style.key)) ||
			(style.isApi && styleApi === apiName)) {
			
			// manage potential runtime conditions for the style
			var conditionals = {
				platform: [],
				formFactor: ''
			};

			if (style.queries) {
				// handle platform device query
				// - Make compile time comparison if possible
				// - Add runtime conditional if platform is not known
				var q = style.queries;
				if (q.platform) {
					if (platform) {
						if (!_.contains(q.platform,platform)) {
							return;
						}
					} else {
						_.each(q.platform, function(p) {
							conditionals.platform.push(CU.CONDITION_MAP[p]['runtime']);
						});
					}
				}

				// handle formFactor device query
				if (q.formFactor === 'tablet') {
					conditionals.formFactor = 'Alloy.isTablet';
				} else if (q.formFactor === 'handheld') {
					conditionals.formFactor = 'Alloy.isHandheld';
				}

				// assemble runtime query
				var pcond = conditionals.platform.length > 0 ? '(' + conditionals.platform.join(' || ') + ')' : '';
				var joinString = pcond && conditionals.formFactor ? ' && ' : '';
				var conditional = pcond + joinString + conditionals.formFactor;

				// push styles if we need to insert a conditional
				if (conditional) {
					if (lastObj) {
						styleCollection.push({style:lastObj});
						styleCollection.push({style:style.style, condition:conditional});
						lastObj = {};
					}
				} else {
					_.extend(lastObj,style.style);
				}
			} else {
				_.extend(lastObj, style.style);
			}
		}
	});

	// add in any final styles
	_.extend(lastObj, extraStyle || {});
	if (!_.isEmpty(lastObj)) { styleCollection.push({style:lastObj}); }

	// substitutions for binding
	_.each(styleCollection, function(style) {
		_.each(style.style, function(v,k) {
			if (_.isString(v)) {
				var match = v.match(bindingRegex);
				if (match !== null) {
					var parts = match[1].split('.');

					// model binding
					if (parts.length > 1) {
						// are we bound to a global or controller-specific model?
						var modelVar = parts[0] === '$' ? parts[0] + '.' + parts[1] : 'Alloy.Models.' + parts[0];
						var attr = parts[0] === '$' ? parts[2] : parts[1];

						// ensure that the bindings for this model have been initialized
						if (!_.isArray(exports.bindingsMap[modelVar])) {
							exports.bindingsMap[modelVar] = [];
						}

						// create the binding object
						var bindingObj = {
							id: id,
							prop: k,
							attr: attr
						};

						// make sure bindings are wrapped in any conditionals
						// relevant to the curent style
						if (theState.condition) {
							bindingObj.condition = theState.condition;
						}

						// add this property to the global bindings map for the 
						// current controller component
						exports.bindingsMap[modelVar].push(bindingObj);

						// since this property is data bound, don't include it in 
						// the style statically
						delete style.style[k];
					} 
					// collection binding
					else {
						var modelVar = theState && theState.model ? theState.model : CONST.BIND_MODEL_VAR;
						var transform = modelVar + "." + CONST.BIND_TRANSFORM_VAR + "['" + match[1] + "']";
						var standard = modelVar + ".get('" + match[1] + "')";
						var modelCheck = "typeof " + transform + " !== 'undefined' ? " + transform + " : " + standard; 
						style.style[k] = STYLE_EXPR_PREFIX + modelCheck;
					}
				}
			}
		});
	});

	function processStyle(style, opts) {
		opts || (opts = {});
		style = opts.fromArray ? {0:style} : style;
		var groups = {};

		// need to add "properties" and bindIds for ListItems
		if (theState && theState.isListItem && opts.firstOrder && !opts.fromArray) {
			for (var sn in style) {
				var value = style[sn];
				var prefixes = sn.split(':');
				if (prefixes.length > 1) {
					var bindId = prefixes[0];
					groups[bindId] || (groups[bindId] = {});
					groups[bindId][prefixes.slice(1).join(':')] = value;
				} else {
					// allow template to be specified
					if (sn === 'template') {
						groups.template = value;
					} else {
						groups.properties || (groups.properties = {});
						groups.properties[sn] = value;
					}
				}
			}
			style = groups;
		}

		for (var sn in style) {
			var value = style[sn],
				prefix = opts.fromArray ? '' : sn + ':';

			if (_.isString(value)) {
				var matches = value.match(regex);
				if (matches !== null) {
					code += prefix + matches[1] + ','; // matched a JS expression
				} else {
					code += prefix + '"' + value + '",'; // just a string
				}
			} else if (_.isArray(value)) {
				code += prefix + '[';
				_.each(value, function(v) {
		 			processStyle(v, {fromArray:true});
		 		});
				code += '],';
			} else if (_.isObject(value)) {
			 	if (value[STYLE_ALLOY_TYPE] === 'var') {
			 		code += prefix + value.value + ','; // dynamic variable value
			 	} else {
			 		// recursively process objects
			 		code += prefix + '{';
			 		processStyle(value);
			 		code += '},';
			 	}
			} else {
				code += prefix + JSON.stringify(value) + ','; // catch all, just stringify the value
			}
		}
	}

	// Let's assemble the fastest factory method object possible based on
	// what we know about the style we just sorted and assembled
	var code = '';
	if (styleCollection.length === 0) {
		code += '{}';
	} else if (styleCollection.length === 1) {
		if (styleCollection[0].condition) {
			// check the condition and return the object
			code += styleCollection[0].condition + ' ? {' + processStyle(styleCollection[0].style, {firstOrder:true}) + '} : {}';
		} else {
			// just return the object
			code += '{';
			processStyle(styleCollection[0].style, {firstOrder:true});
			code += '}';
		}
	} else if (styleCollection.length > 1) {
		// construct self-executing function to merge styles based on runtime conditionals
		code += '(function(){\n';
		code += 'var o = {};\n';
		for (var i = 0, l = styleCollection.length; i < l; i++) {
			if (styleCollection[i].condition) {
				code += 'if (' + styleCollection[i].condition + ') ';
			} 
			code += '_.extend(o, {';
			processStyle(styleCollection[i].style, {firstOrder:true});
			code += '});\n';
		}
		code += 'return o;\n'
		code += '})()'
	}
	
	//console.log(code);

	return code;
}

