import { Message, Contact } from '../models'
/**
 *  MongoDB report for ack messages 
 [
  {
    '$match': {
      'timestamp': {
        '$gte': 1625626800,         //@param timestamp variable greater or equal to
        '$lte': 1628115650606      //@param timestamp variable lower or equal to
      }, 
      'type': 'ptt',               //@param string tipe of message to search
      'ack': 1                     //@param int ack number to sarch [ACK_ERROR: -1, ACK_PENDING: 0, ACK_SERVER: 1, ACK_DEVICE: 2, ACK_READ: 3, ACK_PLAYED: 4]
    }
  }, {
    '$lookup': {
      'from': 'contacts', 
      'localField': 'to', 
      'foreignField': 'id._serialized', 
      'as': 'contact'
    }
  }, {
    '$project': {
      'body': 1, 
      'timestamp': 1, 
      'type': 1, 
      'ack': 1, 
      'hasMedia': 1, 
      'mediaKey': 1, 
      'contact': 1
    }
  }
] */