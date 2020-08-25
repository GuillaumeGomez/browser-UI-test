FROM ubuntu:16.04

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

RUN curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
RUN apt install -y nodejs

RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'

RUN apt-get update && apt-get install -y --no-install-recommends \
  google-chrome-unstable \
  && rm -rf /var/lib/apt/lists/*

COPY ./src browser-ui-test-src
COPY ./package*.json ./

RUN npm install

# never use the "--no-sandbox" outside of a container!
ENTRYPOINT ["node", "./browser-ui-test-src/index.js", "--no-sandbox"]
# to be able to pass arguments to index.js
CMD []
