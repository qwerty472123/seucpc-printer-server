# seucpc-printer-server

This is a printer-server for ICPC/CCPC-like contest on Ubuntu.

## Run

Copy `config-example.json` to `config.json` and change it as you want.

```bash
npm install
npm start
```

You can also use forever-service to create a service.

## More infomation

This server can run independently without client to be a web printer.

It also can be cooperated with seucpc-printer-client to provide service for ICPC/CCPC-like contest.

Its chat and config server are universal to other propose.
