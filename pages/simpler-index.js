import React from 'react';
import marked from 'marked';
import Style from '../parts/style.js';
import _ from 'lodash';

let md = `# Grant Custer 

I'm a designer and front-end developer interested in
procedural generation, data visualization, product design and rethinking
things from scratch.

## Links
- [Feed](http://feed.grantcuster.com)
- [Observable](https://observablehq.com/@grantcuster)
- link`;

let raw = `Grant Custer 
Design–Code

I'm a designer and front-end developer interested in procedural generation, data visualization, product design and rethinking things from scratch.

I work at Cloudera Fast Forward Labs where we build prototypes and write reports on near future technologies.

Links
- Feed - http://feed.grantcuster.com
- Observable - https://observablehq.com/@grantcuster
- Feed - http://feed.grantcuster.com
- Observable - https://observablehq.com/@grantcuster`;

function getColumnNumber(width, c_width, set_even = false) {
  let columns = Math.floor(width / c_width);
  if (set_even) columns = Math.floor(columns / 2) * 2;
  return columns;
}

function getRowNumber(height, r_height) {
  return Math.floor(height / r_height);
}

function contain(c, r, aspect) {
  let _w, _h;
  if (aspect >= c / r) {
    // wider
    _w = c;
    _h = Math.round(c / aspect);
  } else {
    // taller
    _h = r;
    _w = Math.round(r * aspect);
  }
  let x = Math.floor((c - _w) / 2);
  let y = Math.floor((r - _h) / 2);
  return { w: _w, h: _h, x, y };
}

function getPixels(columns, rows, data) {
  // https://www.dfstudios.co.uk/articles/programming/image-programming-algorithms/image-processing-algorithms-part-5-contrast-adjustment/
  let contrast_set = 60;
  let contrast = (259 * (contrast_set + 255)) / (255 * (259 - contrast_set));

  let chars = [];
  for (var i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    // https://stackoverflow.com/a/596241/8691291
    let luma = 0.299 * r + 0.587 * g + 0.114 * b;
    let cluma =
      1 - Math.min(Math.max(0, contrast * (luma - 128) + 128), 255) / 255;
    chars.push({ index: i, percent: cluma });
  }

  return chars;
}

function distance(a, b) {
  // from https://developer.hyvor.com/js-euclidean-distance
  return (
    a
      .map((x, i) => Math.abs(x - b[i]) ** 2) // square the difference
      .reduce((sum, now) => sum + now) ** // sum
    (1 / 2)
  );
}

class Index extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      mount_check: 'unmounted',
      pixels: null,
      letters: null,
      pixel_letters: null,
    };
    this.setPixels = this.setPixels.bind(this);
    this.setLetters = this.setLetters.bind(this);
  }

  setPixels(image) {
    let { box } = this.getLayout();

    let canvas = document.createElement('canvas');
    canvas.width = box.w;
    canvas.height = box.h;
    let ctx = canvas.getContext('2d');
    // turn off image aliasing
    ctx.msImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, box.w, box.h);
    let image_data = ctx.getImageData(0, 0, box.w, box.h);

    let pixels = getPixels(box.w, box.h, image_data.data);

    this.setState({ pixels: pixels }, function() {
      this.setLetters();
    });
  }

  setLetters() {
    let { font_size, line_height, ratio } = this.props;
    let font = 'IBM Plex Mono';

    let sorted = _.orderBy(this.state.pixels, 'percent', 'desc');

    let mod = raw.replace(/\n/g, ' ');
    let letters = mod.split('');
    let unique_letters = _.uniq(letters);

    let temp = unique_letters.map(l => {
      let fs = font_size * 8;
      let height = fs * line_height;
      let width = Math.ceil(ratio * height);

      let canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      let x = 0;
      let y = 0;
      let ctx = canvas.getContext('2d');
      ctx.font = `${fs}px ${font}`;
      ctx.fillText(l, -x, -y + height * (3 / 4));

      let data = ctx.getImageData(0, 0, width, height).data;
      let vals = [];
      for (let i = 0; i < data.length; i += 4) {
        // check alpha
        let a = data[i + 3];
        let val = a > 255 / 2 ? 1 : 0;
        vals.push(val);
      }
      let ons = vals.filter(v => v === 1);
      let percent = ons.length / vals.length;

      return percent;
    });

    // rescale
    let max = _.max(temp);
    let rescaled = temp.map(p => {
      return p / max;
    });

    let lookup = {};
    for (let i = 0; i < rescaled.length; i++) {
      lookup[unique_letters[i]] = rescaled[i];
    }
    console.log(lookup);

    let percent_letters = letters.map((l, i) => {
      let percent = lookup[l];
      return { letter: l, percent };
    });

    let sorted_letters = _.orderBy(percent_letters, 'percent', 'desc');

    let combined = sorted.map((o, i) => {
      let letter;
      if (sorted_letters[i] !== undefined) {
        letter = sorted_letters[i].letter;
      } else {
        letter = ' ';
      }
      return Object.assign({}, o, { letter });
    });

    let pixel_letters = _.orderBy(combined, 'index', 'asc');

    this.setState({ letters: unique_letters, pixel_letters });
  }

  componentDidMount() {
    let image = new Image();
    image.onload = () => {
      this.setPixels(image);
    };
    image.src = `/static/images/grant.png`;

    this.setState({ mount_check: 'mounted' });
  }

  getLayout() {
    let { width, height, font_size, line_height, ratio } = this.props;

    let char_height = font_size * line_height;
    let char_width = Math.round(char_height * ratio * 100) / 100;

    let padding = char_height / 4;

    let columns = getColumnNumber(width - padding * 2, char_width);
    let rows = getRowNumber(height - padding * 2, char_height);
    let grid = {
      w: columns * char_width,
      h: rows * char_height,
    };

    let split_padding = 2;
    let left_columns = Math.floor(columns / 2) - split_padding;
    let right_columns = Math.ceil(columns / 2) - split_padding;

    let box = contain(left_columns, rows, 1 / ratio);

    return {
      char_height,
      char_width,
      padding,
      columns,
      rows,
      grid,
      split_padding,
      left_columns,
      right_columns,
      box,
    };
  }

  render() {
    let { letters, pixel_letters, pixels } = this.state;
    let {
      char_height,
      char_width,
      padding,
      columns,
      rows,
      grid,
      split_padding,
      left_columns,
      right_columns,
      box,
    } = this.getLayout();

    return (
      <div
        style={{
          fontFamily: "'IBMPlexMono-Regular', 'IBM Plex Mono'",
          position: 'relative',
        }}
      >
        {true ? (
          <div
            style={{
              position: 'absolute',
              width: grid.w,
              height: grid.h,
              left: padding,
              top: padding,
              display: 'flex',
              flexWrap: 'wrap',
              display: 'none',
            }}
          >
            {[...Array(columns * rows)].map(n => (
              <div
                style={{
                  width: char_width,
                  height: char_height,
                  outline: 'solid 1px #ccc',
                }}
              />
            ))}
          </div>
        ) : null}

        <div
          style={{
            position: 'absolute',
            width: grid.w,
            height: grid.h,
            left: padding,
            top: padding,
            display: 'flex',
          }}
        >
          <div
            style={{
              width: left_columns * char_width,
              height: grid.h,
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: box.x * char_width,
                top: box.y * char_height,
                width: box.w * char_width + 1,
                height: box.h * char_height,
                display: 'flex',
                flexWrap: 'wrap',
                display: 'none',
              }}
            >
              {pixels !== null
                ? pixels.map(p => {
                    return (
                      <div
                        style={{
                          width: char_width,
                          height: char_height,
                          display: 'flex',
                          background: `rgba(${p.percent * 255}, ${p.percent *
                            255}, ${p.percent * 255}, 1)`,
                        }}
                      />
                    );
                  })
                : null}
            </div>

            {pixel_letters !== null ? (
              <div
                style={{
                  position: 'absolute',
                  left: box.x * char_width,
                  top: box.y * char_height,
                  width: box.w * char_width + 1,
                  height: box.h * char_height,
                  display: 'flex',
                  flexWrap: 'wrap',
                }}
              >
                {pixel_letters.map(l => (
                  <div style={{ width: char_width, height: char_height }}>
                    {l.letter}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div
            style={{
              width: right_columns * char_width,
              height: grid.h,
              marginLeft: char_width * split_padding * 2,
            }}
          >
            <div
              style={{ whiteSpace: 'pre-wrap', maxWidth: char_width * 70 + 1 }}
            >
              {raw}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default Style(Index);
