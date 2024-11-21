# Assignment Builder

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app). But then migrated to `vite`

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:5173](http://localhost:5173) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.
API calls are proxied to either the servers running in development mode see `dstart` in the root folder.  Or to the Docker based servers, you will need to adjust the port setting in `vite.config.ts`  (add port 8080 to run with `dstart` servers)


### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

### Production

For production, the React app is currently mounted as a static app within the `assignment` server.  This will need to change eventually so that we can server the correct versions of the rest of the runestone javascript.
