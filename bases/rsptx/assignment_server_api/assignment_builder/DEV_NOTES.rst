
This is a trial implementation of a new assignment interface using React for frontend development and FastAPI on the backend.

1. use create-react-app to create a new project
2. Update public/index.html to pull in the webpacked runestone components
3. Need to include jQuery for the components...
4. update the package.json file with...

    ::
        "proxy": "http://localhost",
        "homepage": "/assignments/react",
5. Update the assignment app to mount 'react' as a static folder
6. when you run ``npm run build`` it will use environment variables set in .env.production to set the base url for the api calls.
7. See vite.config.ts to configure a different build folder for the react app.



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


Save the state as javascript object.  Save that in the source field of the database for the question.
Write code to convert the javascript to the required html

Save the output as a pretext string.  Make a generic function to convert a json object to pretext.

State
-----

I have refactored the activecode parts into an activecode component.  BUT the state from
the component needs to be visible to the app so that it can do the preview... Unless the preview should be moved into the component?  The save should also be in the component, but then a second save is needed to save the assignment.

But in any case at least the identifier for the activecode component needs to be visible to the app so that it can be saved in the database when the assignment is saved.
