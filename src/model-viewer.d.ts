declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        alt?: string;
        'camera-controls'?: boolean;
        'auto-rotate'?: boolean;
        'rotation-per-second'?: string;
        'shadow-intensity'?: string | number;
        'environment-image'?: string;
        exposure?: string | number;
        style?: React.CSSProperties;
        'camera-orbit'?: string;
        'min-camera-orbit'?: string;
        'max-camera-orbit'?: string;
        'field-of-view'?: string;
        'min-field-of-view'?: string;
        'max-field-of-view'?: string;
        'interaction-prompt'?: string;
        'interaction-prompt-style'?: string;
        'interaction-prompt-threshold'?: string | number;
        'ar'?: boolean;
        'ar-modes'?: string;
        'ar-scale'?: string;
        'ar-placement'?: string;
        'ios-src'?: string;
        poster?: string;
        'reveal'?: string;
        'loading'?: string;
        'skybox-image'?: string;
        'skybox-height'?: string | number;
        'draco-decoder-location'?: string;
        'resolve-color'?: string;
        'tone-mapping'?: string;
        'touch-action'?: string;
        'orbit-sensitivity'?: string | number;
        'zoom-sensitivity'?: string | number;
        'pan-sensitivity'?: string | number;
        'disable-pan'?: boolean;
        'disable-zoom'?: boolean;
        'disable-tap'?: boolean;
        'bounds'?: string;
        'interpolation-decay'?: string | number;
        'minimum-render-scale'?: string | number;
        'max-camera-distance'?: string;
        'min-camera-distance'?: string;
        'scale'?: string;
        'orientation'?: string;
        'animate'?: boolean;
        'animation-name'?: string;
        'animation-crossfade-duration'?: string | number;
        'autoplay'?: boolean;
        'variant-name'?: string;
        'material-variant'?: string;
        'scene-viewer'?: boolean;
        'quick-look'?: boolean;
        'webxr'?: boolean;
        'ar-status'?: string;
        'ar-tracking'?: string;
        'ar-error'?: string;
        'progress'?: string;
        'onArStatus'?: (event: Event) => void;
        'onArTracking'?: (event: Event) => void;
        'onArError'?: (event: Event) => void;
        'onProgress'?: (event: Event) => void;
        'onLoad'?: (event: Event) => void;
        'onError'?: (event: Event) => void;
        'onModelVisibility'?: (event: Event) => void;
        'onPosterDismissed'?: (event: Event) => void;
        'onRenderScale'?: (event: Event) => void;
        'onCameraChange'?: (event: Event) => void;
        'onIntersection'?: (event: Event) => void;
        'onPlaying'?: (event: Event) => void;
      },
      HTMLElement
    >;
  }
}