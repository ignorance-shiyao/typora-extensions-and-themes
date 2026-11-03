# Path adapter for the upstream Jekyll gallery. Applied only to build output;
# the upstream checkout and V1's layout, theme content and downloads stay intact.
require "uri"
require "nokogiri"

module LegacyThemes
  PREFIX = "/v1"
  HOSTS = %w[theme.typora.io themes.typora.io theme.typoraio.cn themes.typoraio.cn].freeze

  def self.version_switcher(doc)
    header = doc.at_css("#header .gallery")
    return unless header
    return if header.at_css(".version-switcher")

    menu = Nokogiri::HTML.fragment(<<~HTML).at_css("details")
      <details class="version-switcher">
        <summary class="v2" aria-label="Typora version"><span>1.0</span><svg class="version-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="m2 3.5 3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg></summary>
        <div class="version-options" aria-label="Typora versions">
          <a href="/">2.0 beta</a>
          <a href="/v1/" aria-current="true">1.0</a>
        </div>
      </details>
    HTML
    brand = Nokogiri::XML::Node.new("div", doc)
    brand["class"] = "product-brand legacy-version-brand"
    if (title = header.at_css(".product-name"))
      title.replace(brand)
      brand.add_child(title)
    else
      # Theme detail pages have a Back link instead of a Typora title.
      brand["class"] += " legacy-version-only"
      header.add_child(brand)
    end
    brand.add_child(menu)
    doc.at_css("head").add_child('<link rel="stylesheet" href="/v1/assets/version-switcher.css">')
    doc.at_css("body").add_child('<script src="/v1/assets/version-switcher.js" defer></script>')
  end

  def self.url(value)
    return value if value.nil? || value.empty?

    path = value
    if value.start_with?("//") || value.match?(%r{\Ahttps?://}i)
      uri = URI.parse(value.start_with?("//") ? "https:#{value}" : value)
      return value unless HOSTS.include?(uri.host&.downcase)

      path = uri.request_uri
      path += "##{uri.fragment}" if uri.fragment
    end
    return value unless path.start_with?("/") && !path.start_with?("//")
    return path if path.match?(%r{\A/v1(?:/|[?#]|\z)})

    "#{PREFIX}#{path}"
  rescue URI::InvalidURIError
    value
  end

  def self.css(content)
    content.gsub(/url\(\s*(["']?)(.*?)\1\s*\)/i) do
      "url(#{$1}#{url($2.strip)}#{$1})"
    end.gsub(/(@import\s+)(["'])(.*?)\2/i) do
      "#{$1}#{$2}#{url($3)}#{$2}"
    end
  end

  def self.html(content)
    doc = Nokogiri::HTML(content)
    doc.css("*").each do |node|
      %w[href src poster action data-src].each do |attribute|
        node[attribute] = url(node[attribute]) if node[attribute]
      end
      # The legacy gallery currently uses src, but keep ordinary responsive
      # images working too. Data-URL srcsets are left intact.
      if node["srcset"] && !node["srcset"].include?("data:")
        node["srcset"] = node["srcset"].split(",").map do |candidate|
          path, descriptor = candidate.strip.split(/\s+/, 2)
          [url(path), descriptor].compact.join(" ")
        end.join(", ")
      end
      node["style"] = css(node["style"]) if node["style"]
      if node.name == "meta" && %w[og:url og:image twitter:url twitter:image].include?(node["property"] || node["name"])
        node["content"] = url(node["content"]) if node["content"]
      end
    end
    doc.css("style").each { |node| node.content = css(node.content) }
    # Upstream forces HTTPS even on localhost (except port 4000). Keep the
    # production redirect, while allowing this repository's local preview.
    doc.css("script:not([src])").each do |node|
      next unless node.content.include?('window.location.protocol = "https";')

      node.content = "if (![\"localhost\", \"127.0.0.1\", \"[::1]\"].includes(window.location.hostname)) {\n#{node.content}\n}"
    end
    # Add after relocating upstream paths so the V2 link stays at the root.
    version_switcher(doc)
    doc.to_html
  end
end
