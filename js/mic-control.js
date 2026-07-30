/**
 * Mic control for push-to-talk.
 * Patches getUserMedia so we capture a reference to the mic tracks
 * the SDK creates. Then we toggle track.enabled to mute/unmute.
 * When disabled, the browser sends silence.
 */

const micTracks = [];
let muted = true;
let _onMuteChange = null;
let installed = false;

/**
 * Install the getUserMedia interceptor.
 * Call BEFORE Gemini connects so we catch the SDK's mic request.
 */
export function install(onMuteChange) {
    if (installed) return;
    installed = true;
    _onMuteChange = onMuteChange;

    if (!navigator.mediaDevices?.getUserMedia) {
        console.warn("[mic] getUserMedia not available — are you on HTTPS or localhost?");
        return;
    }

    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

    navigator.mediaDevices.getUserMedia = async function (constraints) {
        const stream = await originalGetUserMedia(constraints);

        // Capture any audio tracks the SDK requests
        if (constraints?.audio) {
            for (const track of stream.getAudioTracks()) {
                micTracks.push(track);
                // Start muted
                track.enabled = !muted;
                console.log("[mic] Captured mic track, muted:", muted);
            }
        }

        return stream;
    };
}

export function setMuted(val) {
    muted = val;
    for (const track of micTracks) {
        track.enabled = !muted;
    }
    _onMuteChange?.(muted);
}

export function toggle() {
    setMuted(!muted);
    return muted;
}

export function isMuted() {
    return muted;
}
