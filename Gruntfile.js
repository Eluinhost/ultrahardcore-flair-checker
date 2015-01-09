'use strict';
module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-release');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.initConfig({
        copy: {
            config: {
                src: 'config/config.json.dist',
                dest: 'config/config.json',
                filter: function() {
                    return !(grunt.file.exists(grunt.config('copy.config.dest')));
                }
            }
        },
        mochaTest: {
            test: {
                options: {
                    reporter: 'spec'
                },
                src: ['test/**/*.js']
            }
        },
        release: {
            options: {
                tagName: '<%= version %>',
                commitMessage: 'Release for version <%= version %>.'
            }
        },
        watch: {
            files: ['Gruntfile.js', 'test/**/*.js', 'src/**/*.js'],
            tasks: ['test']
        }
    });

    grunt.event.on('watch', function(action, filepath, target) {
        grunt.log.writeln(target + ': ' + filepath + ' has ' + action);
    });

    // Load grunt tasks automatically
    require('load-grunt-tasks')(grunt);
    grunt.registerTask('test', ['copy', 'mochaTest']);
    grunt.registerTask('test:watch', ['watch']);
    grunt.registerTask('default', ['test']);
};