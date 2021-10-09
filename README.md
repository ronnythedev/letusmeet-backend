## 👉 Get Started

1.  Open the folder's project in VisualStudio Code and open the terminal.
2.  Install dependencies. How? Run the following in the terminal:

    ```
    npm install
    ```

3.  Update the `.env` file with the environment variables.

    3.1. Set the port where the backend server will run

    ```
    PORT=5000
    ```

    3.2. The connection string to the mongo cluster and database

    ```
    MONGO_CONNECTION_STRING=mongodb+srv://<user>:<password>@cluster0.m3ado.mongodb.net/<database>?retryWrites=true&w=majority
    ```

    3.3. The secret used to generate and validate JWT. This should be the same as the one in the frontend project, otherwise the authentication won't be possible.

    ```
    JWT_SECRET=thesecretvalue
    ```

4.  Finally, run the server executing the following in the terminal:

    ```
    npm start
    ```

5.  Now the API should be running and listening requests in the port configured in the `.env` file.
