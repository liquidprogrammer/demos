function clamp(min, value, max) {
    return Math.min(Math.max(value, min), max)
}

class CameraService {
    _x = 0
    _y = 0
    _scale = 1
    _scaleInv = 1

    _vp = { x: 0, y: 0, width: 0, height: 0 }
    limitBounds = undefined

    _minX = Number.MIN_SAFE_INTEGER
    _maxX = Number.MAX_SAFE_INTEGER
    _minY = Number.MIN_SAFE_INTEGER
    _maxY = Number.MAX_SAFE_INTEGER

    _minS = 0.25
    _maxS = 4

    setVpSize(w, h) {
        if (this._vp.width !== w || this._vp.height !== h) {
            this._vp.width = w
            this._vp.height = h
            this.updatePositionScale(this._x, this._y, this._scale)
        }
    }

    setBoundsLimit(bounds) {
        const changed =
            this.limitBounds?.x !== bounds?.x ||
            this.limitBounds?.y !== bounds?.y ||
            this.limitBounds?.width !== bounds?.width ||
            this.limitBounds?.height !== bounds?.height
        if (changed) {
            this.limitBounds = bounds
            this.updatePositionScale(this._x, this._y, this._scale)
        }
    }

    moveBy(dx, dy) {
        this.updatePositionScale(this._x + dx, this._y + dy, this._scale)
    }

    scaleBy(ds, atX, atY) {
        const desiredScale = this._scale * ds
        const clampedScale = clamp(this._minS, desiredScale, this._maxS)
        if (clampedScale !== this._scale) {
            const realDs = clampedScale / this._scale

            const newX = atX - (atX - this._x) * realDs
            const newY = atY - (atY - this._y) * realDs

            this.updatePositionScale(newX, newY, clampedScale)
        }
    }

    updatePositionScale(x0, y0, scale0) {
        const newScale = clamp(this._minS, scale0, this._maxS)
        const bounds = this.limitBounds
        if (bounds) {
            const scale = newScale
            const contentW = bounds.width * scale
            const contentH = bounds.height * scale

            let maxX = -bounds.x * scale
            let minX = maxX - contentW + this._vp.width
            let maxY = -bounds.y * scale
            let minY = maxY - contentH + this._vp.height
            this._minX = minX
            this._maxX = maxX
            this._minY = minY
            this._maxY = maxY
        } else {
            this._minX = Number.MIN_SAFE_INTEGER
            this._maxX = Number.MAX_SAFE_INTEGER
            this._minY = Number.MIN_SAFE_INTEGER
            this._maxY = Number.MAX_SAFE_INTEGER
        }

        const newX = clamp(this._minX, x0, this._maxX)
        const newY = clamp(this._minY, y0, this._maxY)

        const posChanged = newX !== this._x || newY !== this._y
        const scaleChanged = newScale !== this._scale
        if (posChanged || scaleChanged) {
            this._x = newX
            this._y = newY
            this._scale = newScale
            this._scaleInv = 1 / newScale
            return true
        }

        return false
    }
}

let PointerP = {
    clientX: 0,
    clientY: 0,
}

let canvasWidth = 800
let canvasHeight = 400

var canvas = document.createElement('canvas')
canvas.style.cssText = 'touch-action: none;'
canvas.width = canvasWidth
canvas.height = canvasHeight
document.body.appendChild(canvas)

var ctx = canvas.getContext('2d')

var img = new Image()
img.onload = () => {}
img.src = './cat.jpg'

const cameraService = new CameraService()
cameraService._minS = 1

const bboxes = [{
    x: 150,
    y: 150,
    width: 10,
    height: 10,
    color: '#ff0000'
}, {
    x: 350,
    y: 200,
    width: 10,
    height: 10,
    color: '#00ff00'
}]

const enterFrameCallbacks = []

function onEnterFrame(cb) {
	enterFrameCallbacks.push(cb)

	return () => {
		let idx = enterFrameCallbacks.indexOf(cb)
		if (idx !== -1) {
			enterFrameCallbacks.splice(idx, 1)
		}
	}
}

function animate() {
	enterFrameCallbacks.forEach(cb => cb())

    cameraService.setVpSize(canvas.width, canvas.height)
    cameraService.setBoundsLimit({
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height,
    })

    ctx.resetTransform()
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const scale = cameraService._scale
    ctx.setTransform(scale, 0, 0, scale, cameraService._x, cameraService._y)

    const widthR = canvas.width / img.width
    const heightR = canvas.height / img.height

    const r = Math.min(widthR, heightR)

    const dw = img.width * r
    const dh = img.height * r
    const dx = (canvas.width - dw) / 2
    const dy = (canvas.height - dh) / 2

    ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh)

	bboxes.forEach(bbox => {
		const {x,y,width, height, color} = bbox
        ctx.strokeStyle = color
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
	})

    requestAnimationFrame(animate)
}

animate()

//handleMouseEvents()
handleWheelEvent()
handleTouchInputs()

function handleMouseEvents() {
	let isDown = false

	canvas.addEventListener('mousedown', (ev) => {
		isDown = true
		PointerP.clientX = ev.clientX
		PointerP.clientY = ev.clientY
	})

	document.addEventListener('mousemove', (ev) => {
		const dx = ev.clientX - PointerP.clientX
		const dy = ev.clientY - PointerP.clientY

		PointerP.clientX = ev.clientX
		PointerP.clientY = ev.clientY

		if (isDown) {
			cameraService.moveBy(dx, dy)
		}
	})

	document.addEventListener('mouseup', (ev) => {
		isDown = false
	})
}

function handleWheelEvent() {
	canvas.addEventListener('wheel', (ev) => {
    	ev.preventDefault()

    	const delta = getWheelDelta(ev)

    	if (ev.ctrlKey || ev.metaKey) {
        	const ds = Math.exp(-delta.Y / 100)
        	let x = ev.clientX
        	let y = ev.clientY
        	const cl = canvas.getBoundingClientRect()
        	x -= cl.x
        	y -= cl.y
        	cameraService.scaleBy(ds, x, y)
    	} else {
        	cameraService.moveBy(-delta.X, -delta.Y)
    	}
	})

	function getWheelDelta(e) {
    	let t = 0
    	let i = 0
    	if ('deltaX' in e) {
        	t = e.deltaX
        	i = e.deltaY
    	} else if (e.wheelDeltaX != null && e.wheelDeltaY != null) {
        	t = -e.wheelDeltaX / 3
        	i = -e.wheelDeltaY / 3
    	} else {
        	t = 0
        	if (e.wheelDelta != null) {
            	i = -e.wheelDelta / 3
        	}
    	}
    	if (Number.isNaN(t)) {
        	t = 0
    	}
    	if (Number.isNaN(i)) {
        	i = 0
    	}
    	return {
        	X: t,
        	Y: i,
    	}
	}
}

function handleTouchInputs() {
    const ongoingTouches = []

    let prevPinchDistance = null

    const gesturePinchZoom = () => {
        let result = 0
        if (ongoingTouches.length >= 2) {
            const p1 = ongoingTouches[0]
            const p2 = ongoingTouches[1]
            const dx = p2.clientX - p1.clientX
            const dy = p2.clientY - p1.clientY
            const pinchDistance = Math.sqrt(dx * dx + dy * dy)

            if (prevPinchDistance !== null) {
                result = pinchDistance - prevPinchDistance
            }
            prevPinchDistance = pinchDistance
        }

        return result
    }

    const removeTouch = (id) => {
        const idx = ongoingTouches.findIndex((ot) => ot.id === id)
        if (idx !== -1) {
            const t = ongoingTouches[idx]
            ongoingTouches.splice(idx, 1)
            return t
        }
        return undefined
    }

    const getTouch = (id) => ongoingTouches.find((ot) => ot.id === id)

    document.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        e.stopPropagation()

        prevPinchDistance = null

        ongoingTouches.push({
            id: e.pointerId,

            prevClientX: e.clientX,
            prevClientY: e.clientY,

            clientX: e.clientX,
            clientY: e.clientY,
        })
    }, {passive: false})

	onEnterFrame(() => {
        if (ongoingTouches.length >= 2) {

            const cl = canvas.getBoundingClientRect()

            const t1 = ongoingTouches[0]
            const t2 = ongoingTouches[1]
            let prevX = (t1.prevClientX + t2.prevClientX) / 2
            let prevY = (t1.prevClientY + t2.prevClientY) / 2
            prevX -= cl.x
            prevY -= cl.y

            let currX = (t1.clientX + t2.clientX) / 2
            let currY = (t1.clientY + t2.clientY) / 2
            currX -= cl.x
            currY -= cl.y

            const dx = currX - prevX
            const dy = currY - prevY
            cameraService.moveBy(dx, dy)

            // NOTE: pinch to zoom
            const pinchDiff = gesturePinchZoom()
            if (pinchDiff) {
            	console.log('pinch', dx, dy)
                const zoom = Math.exp(pinchDiff / 100)
                cameraService.scaleBy(zoom, currX, currY)
            }
        } else if (ongoingTouches.length === 1) {
            const ot = ongoingTouches[0]

            const dx = ot.clientX - ot.prevClientX
            const dy = ot.clientY - ot.prevClientY
            console.log('frame', dx, dy)
            if (dx || dy) {
                cameraService.moveBy(dx, dy)
            }
        }

        ongoingTouches.forEach((ot) => {
            ot.prevClientX = ot.clientX
            ot.prevClientY = ot.clientY
        })
    })

    document.addEventListener('pointermove', (e) => {
        const t = getTouch(e.pointerId)
        if (!t) {
            return
        }

        e.preventDefault()
        e.stopPropagation()
        t.clientX = e.clientX
        t.clientY = e.clientY

        console.log('move', t)

        PointerP.clientX = e.clientX
        PointerP.clientY = e.clientY
    }, {passive: false})

    document.addEventListener('pointercancel', (e) => {
        removeTouch(e.pointerId)
    }, {passive: false})

    document.addEventListener('pointerup', (e) => {
        removeTouch(e.pointerId)
    }, {passive: false})
}
