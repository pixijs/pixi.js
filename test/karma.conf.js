module.exports = function(config) {
    config.set({

        // base path, that will be used to resolve files and exclude
        basePath : '../',

        frameworks : ['mocha'],

        // list of files / patterns to load in the browser
        files : [
            'node_modules/chai/chai.js',
            'coverage/pixi.instrumented.js',
            'test/lib/**/*.js',
            'test/unit/**/*.js',
            // 'test/functional/**/*.js',
            {pattern: 'test/**/*.png', watched: false, included: false, served: true}
        ],

        // list of files to exclude
        //exclude : [],

        // use dolts reporter, as travis terminal does not support escaping sequences
        // possible values: 'dots', 'progress', 'junit', 'teamcity'
        // CLI --reporters progress
        reporters : [
            'spec',
            'coverage'
        ],

        // web server port
        // CLI --port 9876
        port : 9876,

        // cli runner port
        // CLI --runner-port 9100
        runnerPort : 9100,

        // enable / disable colors in the output (reporters and logs)
        // CLI --colors --no-colors
        colors : true,

        // level of logging
        // possible values: karma.LOG_DISABLE || karma.LOG_ERROR || karma.LOG_WARN || karma.LOG_INFO || karma.LOG_DEBUG
        // CLI --log-level debug
        logLevel : config.LOG_INFO,

        // enable / disable watching file and executing tests whenever any file changes
        // CLI --auto-watch --no-auto-watch
        autoWatch : false,

        // Start these browsers, currently available:
        // - Chrome
        // - ChromeCanary
        // - Firefox
        // - Opera
        // - Safari (only Mac)
        // - PhantomJS
        // - IE (only Windows)
        // CLI --browsers Chrome,Firefox,Safari
        browsers : ['Firefox'],

        // If browser does not capture in given timeout [ms], kill it
        // CLI --capture-timeout 5000
        captureTimeout : 5000,

        // Auto run tests on start (when browsers are captured) and exit
        // CLI --single-run --no-single-run
        singleRun : true,

        // report which specs are slower than 500ms
        // CLI --report-slower-than 500
        reportSlowerThan : 500,

        // FIXME: Currently we are instrumenting as a separate
        // task before running Karma. This is because we must
        // test against a concatenated script.
        // In order to instrument correctly, we must concatenate
        // already instrumented code, and let Karma cover that.
        preprocessors : {
        //    '**/client/js/*.js': 'coverage'
        },

        coverageReporter : {
            type: 'lcov',
            dir: 'coverage/'
        },

        plugins : [
            'karma-chrome-launcher',
            'karma-coverage',
            'karma-firefox-launcher',
            'karma-mocha',
            // 'karma-phantomjs-launcher'
            'karma-spec-reporter'
        ]
    });
};
