
This is a trial implementation of a new assignment interface using React for frontend development and FastAPI on the backend.

1. use create-react-app to create a new project
2. Update public/index.html to pull in the webpacked runestone components
3. Need to include jQuery for the components...
4. update the package.json file with...

    ::
        "proxy": "http://localhost",
        "homepage": "/assignments/react",
5. Update the assignment app to mount 'react' as a static folder
6. when you run ``npm run build`` set the ``BUILD_PATH`` environment variable to the react folder for the assignment app



There are lots more options for the activecode, how to expose them without making the interface too complex? -- maybe an advanced button that unhides a bunch of options?

* timelimit
* stdin
* datafile
* sourcefile
* dburl
* available_files
* compileargs
* linkargs
* interpreterargs
* runargs