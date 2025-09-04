FROM ubuntu:22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    sudo \
    git \
    curl \
    apt-utils \
    wget \
    ca-certificates \
    libexpat1-dev \
    gnupg \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    libxtst6

RUN curl -sL https://deb.nodesource.com/setup_24.x | sudo -E bash - \
    && apt install -y nodejs

RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'

RUN apt-get update && apt-get install -y --no-install-recommends \
  google-chrome-unstable \
  && rm -rf /var/lib/apt/lists/*

COPY ./src browser-ui-test-src
COPY ./package*.json ./

RUN npm install

ENTRYPOINT ["node", "./browser-ui-test-src/index.js"]
# to be able to pass arguments to index.js
CMD []
