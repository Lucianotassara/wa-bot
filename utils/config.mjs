const CONFIG = {
    ENV: {
      DEV: "desa",
      ACC: "raspi",
      PRD: "prod",
      HEADLESS: true
    },
    API: {
      PORT: 3010,
      LOGIN_PSSWD: "SFSRHl8Ro5"
    },
    GSHEET: {
      EXPRESS_API: "http://localhost:3010/fetchPhones",
      SPREADSHEET_ID: "1YBn9H5jipWSST7m2Sv3Hx64jLBI_QxXzUXWEH5NeypI",
      CLIENT_EMAIL: "gsheet-extractor-service-accou@wa-bot-310621.iam.gserviceaccount.com",
      PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCuxzG1MlblYmcl\n33+Bs6ta5erB6bNLDhAgmg4t44+gOtKUzBJNLpb070YKCyITOQUgcy7cWA/6rSs9\nme6QhmVjiChG63y5t3f0wwy8h/pLmbdpWipULZhM+xg1A2aJ5MBt8l1rT93+xZVp\nrr9BUXEx6mfOZNIG/zzl6e2Csv3GdOW4KUFkR1tq3k4iXl+Bez41+IdArdwZA+5S\nfwpvloipmHJknwIeMsZkP62fzeUBxclvQHkCIBMHlkA9UB8p34pMgDNGUxuRetb/\n3bn7Dbufoy7/DGe0UPzeIm5FvsTyEUetpq3IE3f9Qu4PD8uFfPlYekfOY5bnjHoK\nZSYjcZ4pAgMBAAECggEABvbqDKneW5KhwJkY2B7EN8GMqsB4xAdh7iKlaP+14/Ek\nHgjJu+ic3FLCjDjoWTK++Q2N8vrRXDBVVkWRg5HPbXlp/XV5yV69uXOiSMr0Vtnf\nvKN6p1MPzBV/X/FsPxdt8ZOkVFfg5TuTWhw8A8rOg2ovS8Kpudym3RSGwdwHD8bc\nxChYYDACy1vaP2CH0tn/VyeYGb0rcaVxebMpCONDxACTXt2J3LroSUrugna2YKzb\nFaHIXlKmyBSNba8H08ZLJV/LZ1IPJbOrapmLisX6W3fOxrd2Wu0aKMH/6kulrOaF\nMy0sSq0BXvRRN/Ghpcr3pH1vHkyXhA5KPZzIpx+cbwKBgQDqZV9U+2v7gUhCsFx8\naG+FQ0pMf9M59USaunGpfEXk2TJ/KrTFBgTRfRhg1OLSjjeYsKLSc8/HJHg66dYC\nbCxDt2wQfm9BKjW1+UMXThBVDFOJd1woCsnoWtWjztRHZwO93+oaHi8iLtAtuqg7\nvlU7vgK+MDmw8pMNBBukSoxoQwKBgQC+4x++YdvqY8N4YYLr1XkaUubEQP/EnVAm\nolT3E1c940jAD7kOKWfwRqkPMTzXyuyp9RVXuyjUd2acEeZ7KTmhfKBi+lQ+zrUd\nRjpbrBsKlN0HKdoylh9PJbd6Mx+f2Sl3Z3T4c4Gdz9nopIIRuK9R02nmrCk67sTB\nfDZdoo/fIwKBgQCBKc94svt0Im/BYBH29E3P7563vRCWtZNSeD8+GB8j1pQ/AzeO\nAp0RG5Ade/Jp+LimSV/P/MWYhX5DaKvntdhGkILaK/H+xNXIK01PQFM7qok2DTIZ\nVqigg72KgOT1W8zyCrukHNH4Ujehm2QtV9r8Ct7UExsXaPSjjYn15KaupQKBgAWW\n4vQRK35Wg3+/4zSCoLQrn0Q53wNj09f9wt0lPNW8FQJCs5l9juSTPRoLyAtNjtZ/\nLavO+CgYgvGo+IW8tEpNOukLCXJ5XQZJayYKCRSrPTmbeR8oFCyeHxw96PwmQLeV\nWPB5eV8kme3c+04HiWKs/RnbCq4GFc7Qk0r0mp/fAoGAVjELFzv/8QQSDi9oTyeJ\naA2dSp9dLdJuLPspHEzvS8dox0Z2IrkFfcjsUsBawDtMxK9dpreMg5ZNtrTcOXjw\nYqfsjZ/PsoqBLG0PsFp52986R+iCwmy7zXsEAQDUP3nXRh7s5C5YsMtRC/IBVlyx\nNW2BQLFwcBvXzAwtCYLf8tU=\n-----END PRIVATE KEY-----\n"
    },
    WA: {
      CLIENT_ID: "lucho-bot",
      MONGO_URI: "mongodb://localhost/wa-bot",
      SENDER_GROUP: "-1618398026@g.us",
      ADMIN_GROUP: "5491134005591-1618398026@g.us",
      SECRET: "Basic YWRtaW46U0ZTUkhsOFJvNQ==",
      MSG_LIMIT: 200
    },
    CMD: {
      GET_STATUS: "!estado",
      SEND_MSG: "!enviar-destinatarios",
      UPDATE_CONTACTS: "!contactos",
      FORWARD_MODE: "!reenviar"
    }
  };
  
  export default CONFIG;
  