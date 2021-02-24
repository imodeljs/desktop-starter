# Desktop Starter

Copyright © Bentley Systems, Inc.

The purpose of this app is to serve as a desktop starter to be copied by a developer.

See <https://itwinjs.org> for comprehensive documentation on the iModel.js API and the various constructs used in this app.

![App Screenshot](./docs/header.png)

## Development setup

1. Install the dependencies:

    ```sh
    npm install
    ```

1. Start the app:

    ```sh
    npm start
    ```

## Advanced configuration options

If an iModel is needed for testing, follow the developer registration procedure [here](https://itwinjs.org/learning/tutorials/create-test-imodel-offline/)

### Client registration

These variables must be updated before deployment, but the supplied defaults can be used for testing on localhost. Create a client registration using the procedure [here](https://itwinjs.org/learning/tutorials/registering-applications/). For the purpose of running this app on localhost, ensure your registration includes <http://localhost:3000/signin-oidc> as a valid redirect URI.

## Contributing

[Contributing to iModel.js](https://github.com/imodeljs/imodeljs/blob/master/CONTRIBUTING.md)
