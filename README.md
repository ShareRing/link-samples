# LINK Samples

Code samples to showcase LINK integration, particularly how to request data from end-user with ShareRing Link.

## link-integration-react

This is a simple React webapp, bootstrapped with [Create React App](https://github.com/facebook/create-react-app). It shows how to use ShareRing Link Javascript Library in a React project to generate QR code with an existing Query ID created in ShareRing LINK dashboard.

## Create ShareRing Link query

1. Get a subscription on ShareRing Link. On test environment the subcription will be free of charge using a test credit card.
2. (Optionally) Create an endpoint (webhook) which will receive data shared from the users.
3. Create a query and select the endpoint created above.

Refer to [the documentation](https://docs.shareri.ng/digital-identity/sharering-link/verification-levels-and-keywords) for how to create a query.

## Run the servers

The repo uses `yarn` as package manager. Install it first. At root directory:

```sh
# install dependencies
$ yarn install

# start frontend
$ yarn workspace link-integration-react start
```

By default, the server runs on port `:3000`.
