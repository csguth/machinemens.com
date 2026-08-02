// Reusable Alpine.js component that wraps a single YouTube video with a
// fully custom, minimal player UI (no native YouTube controls/branding),
// built on top of the YouTube IFrame Player API. The real player is only
// created once the visitor presses play (poster/facade pattern), so pages
// with several videos stay light until a video is actually watched.
//
// Usage (see layouts/partials/youtube-player.html):
//   x-data="ytPlayer(videoId, title, { play, pause, fullscreen })"

let ytIframeApiPromise = null;

function loadYouTubeIframeApi() {
  if (ytIframeApiPromise) return ytIframeApiPromise;
  ytIframeApiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === 'function') previousReady();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return ytIframeApiPromise;
}

let ytPlayerMountCounter = 0;

// YouTube always flashes a title/channel/branding overlay for several
// seconds whenever a video starts playing, regardless of mouse position or
// the controls=0 playerVar — there's no documented API parameter to
// suppress it. To avoid showing that overlay, playback starts muted behind
// our own poster and is only revealed (and unmuted) once the overlay has
// had time to fade on its own.
const YT_REVEAL_DELAY_MS = 8000;

function ytPlayer(videoId, title, labels) {
  labels = labels || {};

  return {
    videoId,
    title,
    playLabel: labels.play || 'Play',
    pauseLabel: labels.pause || 'Pause',
    fullscreenLabel: labels.fullscreen || 'Fullscreen',
    // The IFrame Player API requires an element id (string), not a DOM node,
    // so each instance gets a unique id to target with new YT.Player(id, ...).
    mountId: `yt-player-mount-${++ytPlayerMountCounter}`,
    player: null,
    started: false,
    // True once the initial branding overlay has had time to fade and the
    // real player (with sound) is shown in place of our poster.
    revealed: false,
    playing: false,
    duration: 0,
    currentTime: 0,
    progressTimer: null,
    revealTimer: null,

    get posterUrl() {
      return `https://img.youtube.com/vi/${this.videoId}/hqdefault.jpg`;
    },
    get progressPct() {
      return this.duration ? (this.currentTime / this.duration) * 100 : 0;
    },

    async start() {
      if (this.started) return;
      this.started = true;
      const YT = await loadYouTubeIframeApi();
      this.player = new YT.Player(this.mountId, {
        // The API defaults to a fixed 640x360 iframe; force it to fill the
        // aspect-video container instead (see also ".yt-player iframe" in
        // site.css, since the generated iframe doesn't inherit our classes).
        width: '100%',
        height: '100%',
        videoId: this.videoId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          playsinline: 1,
          fs: 0,
          mute: 1
        },
        events: {
          onReady: (e) => {
            // Start muted so the branding overlay plays out silently behind
            // our poster; unmute only once it's safe to reveal the player.
            e.target.mute();
            e.target.playVideo();
            this.revealTimer = setTimeout(() => {
              this.revealed = true;
              this.player.unMute();
            }, YT_REVEAL_DELAY_MS);
          },
          onStateChange: (e) => this.handleStateChange(e)
        }
      });
    },

    handleStateChange(e) {
      this.playing = e.data === window.YT.PlayerState.PLAYING;
      clearInterval(this.progressTimer);
      if (this.playing) {
        this.duration = this.player.getDuration();
        this.progressTimer = setInterval(() => {
          this.currentTime = this.player.getCurrentTime();
        }, 250);
      }
    },

    togglePlay() {
      if (!this.player) return;
      this.playing ? this.player.pauseVideo() : this.player.playVideo();
    },

    seek(event) {
      if (!this.player || !this.duration) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
      this.player.seekTo(ratio * this.duration, true);
    },

    toggleFullscreen() {
      const el = this.$refs.wrapper;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (el.requestFullscreen) {
        el.requestFullscreen();
      }
    },

    formatTime(seconds) {
      if (!seconds || Number.isNaN(seconds)) return '0:00';
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    }
  };
}
