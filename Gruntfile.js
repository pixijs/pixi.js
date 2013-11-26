module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-concat-sourcemap');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-qunit');
    grunt.loadNpmTasks('grunt-contrib-yuidoc');
    grunt.loadNpmTasks('grunt-contrib-watch');

    var root = 'src/pixi/',
        debug = 'bin/pixi.dev.js',
        srcFiles = [
            '<%= dirs.src %>/Intro.js',
            '<%= dirs.src %>/Pixi.js',
            '<%= dirs.src %>/core/Point.js',
            '<%= dirs.src %>/core/Rectangle.js',
            '<%= dirs.src %>/core/Polygon.js',
            '<%= dirs.src %>/core/Circle.js',
            '<%= dirs.src %>/core/Ellipse.js',
            '<%= dirs.src %>/core/Matrix.js',
            '<%= dirs.src %>/display/DisplayObject.js',
            '<%= dirs.src %>/display/DisplayObjectContainer.js',
            '<%= dirs.src %>/display/Sprite.js',
            '<%= dirs.src %>/display/MovieClip.js',
            '<%= dirs.src %>/filters/FilterBlock.js',
            '<%= dirs.src %>/text/Text.js',
            '<%= dirs.src %>/text/BitmapText.js',
            '<%= dirs.src %>/InteractionManager.js',
            '<%= dirs.src %>/display/Stage.js',
            '<%= dirs.src %>/utils/Utils.js',
            '<%= dirs.src %>/utils/EventTarget.js',
            '<%= dirs.src %>/utils/Detector.js',
            '<%= dirs.src %>/utils/Polyk.js',
            '<%= dirs.src %>/renderers/webgl/WebGLShaders.js',
            '<%= dirs.src %>/renderers/webgl/PixiShader.js',
            '<%= dirs.src %>/renderers/webgl/StripShader.js',
            '<%= dirs.src %>/renderers/webgl/PrimitiveShader.js',
            '<%= dirs.src %>/renderers/webgl/WebGLGraphics.js',
            '<%= dirs.src %>/renderers/webgl/WebGLRenderer.js',
            '<%= dirs.src %>/renderers/webgl/WebGLBatch.js',
            '<%= dirs.src %>/renderers/webgl/WebGLRenderGroup.js',
            '<%= dirs.src %>/renderers/webgl/WebGLFilterManager.js',
            '<%= dirs.src %>/renderers/canvas/CanvasRenderer.js',
            '<%= dirs.src %>/renderers/canvas/CanvasGraphics.js',
            '<%= dirs.src %>/primitives/Graphics.js',
            '<%= dirs.src %>/extras/Strip.js',
            '<%= dirs.src %>/extras/Rope.js',
            '<%= dirs.src %>/extras/TilingSprite.js',
            '<%= dirs.src %>/extras/Spine.js',
            '<%= dirs.src %>/extras/CustomRenderable.js',
            '<%= dirs.src %>/textures/BaseTexture.js',
            '<%= dirs.src %>/textures/Texture.js',
            '<%= dirs.src %>/textures/RenderTexture.js',
            '<%= dirs.src %>/loaders/AssetLoader.js',
            '<%= dirs.src %>/loaders/JsonLoader.js',
            '<%= dirs.src %>/loaders/SpriteSheetLoader.js',
            '<%= dirs.src %>/loaders/ImageLoader.js',
            '<%= dirs.src %>/loaders/BitmapFontLoader.js',
            '<%= dirs.src %>/loaders/SpineLoader.js',
            '<%= dirs.src %>/filters/AbstractFilter.js',
            '<%= dirs.src %>/filters/ColorMatrixFilter.js',
            '<%= dirs.src %>/filters/GrayFilter.js',
            '<%= dirs.src %>/filters/DisplacementFilter.js',
            '<%= dirs.src %>/filters/PixelateFilter.js',
            '<%= dirs.src %>/filters/BlurXFilter.js',
            '<%= dirs.src %>/filters/BlurYFilter.js',
            '<%= dirs.src %>/filters/BlurFilter.js',
            '<%= dirs.src %>/filters/InvertFilter.js',
            '<%= dirs.src %>/filters/SepiaFilter.js',
            '<%= dirs.src %>/filters/TwistFilter.js',
            '<%= dirs.src %>/filters/ColorStepFilter.js',
            '<%= dirs.src %>/filters/DotScreenFilter.js',
            '<%= dirs.src %>/filters/CrossHatchFilter.js',
            '<%= dirs.src %>/filters/RGBSplitFilter.js',
            
            '<%= dirs.src %>/Outro.js'
        ], banner = [
            '/**',
            ' * @license',
            ' * <%= pkg.name %> - v<%= pkg.version %>',
            ' * Copyright (c) 2012, Mat Groves',
            ' * <%= pkg.homepage %>',
            ' *',
            ' * Compiled: <%= grunt.template.today("yyyy-mm-dd") %>',
            ' *',
            ' * <%= pkg.name %> is licensed under the <%= pkg.license %> License.',
            ' * <%= pkg.licenseUrl %>',
            ' */',
            ''
        ].join('\n');

    grunt.initConfig({
        pkg : grunt.file.readJSON('package.json'),
        dirs: {
            build: 'bin',
            docs: 'docs',
            src: 'src/pixi',
            test: 'test'
        },
        files: {
            srcBlob: '<%= dirs.src %>/**/*.js',
            testBlob: '<%= dirs.test %>/unit/**/*.js',
            build: '<%= dirs.build %>/pixi.dev.js',
            buildMin: '<%= dirs.build %>/pixi.js'
        },
        concat: {
            options: {
                banner: banner
            },
            dist: {
                src: srcFiles,
                dest: '<%= files.build %>'
            }
        },
        concat_sourcemap: {
            dev: {
                files: {
                    '<%= files.build %>': srcFiles
                },
                options: {
                    sourceRoot: '../'
                }
            }
        },
        jshint: {
            beforeconcat: srcFiles,
            test: ['<%= files.testBlob %>'],
            options: {
                asi: true,
                smarttabs: true
            }
        },
        uglify: {
            options: {
                banner: banner
            },
            dist: {
                src: '<%= files.build %>',
                dest: '<%= files.buildMin %>'
            }
        },
        connect: {
            qunit: {
                options: {
                    port: grunt.option('port-test') || 9002,
                    base: './'
                }
            },
            test: {
                options: {
                    port: grunt.option('port-test') || 9002,
                    base: './',
                    keepalive: true
                }
            }
        },
        qunit: {
            all: {
                options: {
                    urls: ['http://localhost:' + (grunt.option('port-test') || 9002) + '/test/index.html']
                }
            }
        },
        yuidoc: {
            compile: {
                name: '<%= pkg.name %>',
                description: '<%= pkg.description %>',
                version: '<%= pkg.version %>',
                url: '<%= pkg.homepage %>',
                logo: '<%= pkg.logo %>',
                options: {
                    paths: '<%= dirs.src %>',
                    outdir: '<%= dirs.docs %>'
                }
            }
        },
        watch: {
            dev: {
                files: ['Gruntfile.js', 'src/**/*.js', 'examples/**/*.html'],
                tasks: ['build-debug'],
                
                // We would need to inject <script> in each HTML...
                // options: {
                //     livereload: true
                // }
            }
        }
    });

    grunt.registerTask('build-debug', ['concat_sourcemap', 'uglify'])
    grunt.registerTask('default', ['concat', 'uglify']);
    grunt.registerTask('build', ['concat', 'uglify']);
    grunt.registerTask('test', ['build', 'connect:qunit', 'qunit']);
    grunt.registerTask('docs', ['yuidoc']);

}