'use strict';
const readline = require("readline")
const fs = require("fs")
const udp = require("dgram")
const net = require("net")
const path = require("path")

const broadcastInterval = 1000

class DetectedConn {
	/**
	 * @param {string} ip
	 * @param {number} port
	 * @param {string} fileName
	 * @param {number} size
	 * @param {number} received
	 */
	constructor(ip, port, fileName, size, received) {
		this.ip = ip
		this.port = port
		this.fileName = fileName
		this.size = size
		this.received == received
	}
	/**
	 * @returns {boolean}
	 * @param {DetectedConn} other
	 */
	equals(other) {
		return (
			this.ip == other.ip &&
			this.port == other.port &&
			this.fileName == other.fileName &&
			this.size == other.size
		)
	}
}

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	removeHistoryDuplicates: true
})

var broadcastSocket = udp.createSocket({
	type: "udp4",
	reuseAddr: true
}, (msg, rInfo) => {
	var [fileName, size, port] = msg.toString().split("::")
	var size = parseInt(size)
	var port = parseInt(port)
	if (typeof (fileName) == "string" && !isNaN(size) && !isNaN(port)) {
		var detected = new DetectedConn(rInfo.address, port, fileName, size, Date.now())
		var equals = false
		for (var thing of detectedConns) {
			if (thing.equals(detected)) {
				this.received = Date.now()
				equals = true
				break
			}
		}

		if (!equals) {
			detectedConns.push(detected)
		}
	}
})
broadcastSocket.bind(1524)

console.log("Transferer v1.0 :: Ctrl+C to quit\n# (s)end or (r)ecive")
var state = "start"
/**
 * @type {string}
 */
var filePath = null
/**
 * @type {DetectedConn[]}
 */
var detectedConns = []
var stats = new fs.Stats()
rl.addListener("line", input => {
	switch (state) {
		case "start":
			if (input == "s" || input == "send") {
				state = "send"
				console.log("# file path = ?")
			} else if (input == "r" || input == "receive") {
				state = "receive"
				console.log("Detected: ")
				detectedConns.forEach((v, i) => {
					console.log(` (${i}) ${v.ip + ":" + v.port}: ${v.fileName} (${v.size}b) T-${Date.now() - v.received}ms`)
				})
				console.log("# index = ?")
			} else {
				console.log("# (s)end or (r)ecive")
			}
			break
		case "send":
			var error = false
			try {
				stats = fs.statSync(input.trim())
				console.log(stats)
			} catch (err) {
				console.error(err)
				console.log("# file path = ?")
				error = true
			}
			if (!error) {
				filePath = input.trim()
				console.log("Waiting for query")
				var sendSocket = net.createServer((socket) => {
					var stream = fs.createReadStream(filePath)
					stream.pipe(socket)
					console.log("Sending file to " + socket.address().address)
					var interval = setInterval(() => {
						console.log(">> " + socket.address().address + ": " + stream.bytesRead  + "/" + stream.readableLength)
					}, 500)
					stream.on("close", () => {
						clearInterval(interval)
					})
				})
				sendSocket.listen()
				setInterval(() => {
					broadcastSocket.setBroadcast(true)
					broadcastSocket.send(path.basename(filePath) + "::" + stats.size + "::" + sendSocket.address().port, broadcastSocket.address().port, "192.168.0.255")
				}, broadcastInterval)
				rl.pause()
			}
			break
		case "receive":
			var index = parseInt(input)
			if (isNaN(index)) console.log("!! malformed number")
			else {
				if (index >= detectedConns.length) console.log("!! index € <0," + detectedConns.length + ")")
				else {
					var selected = detectedConns[index]
					var socket = net.connect(selected.port, selected.ip)
					rl.pause()
					socket.on("connect", () => {
						socket.pipe(fs.createWriteStream("D:\\\\Downloads\\" + selected.fileName))
						var interval = setInterval(() => {
							process.stdout.write("<< " + socket.bytesRead + "/?" + selected.size + "\r")
						}, 100)
					})
				}
			}
			break
	}
})
