ALTER TABLE catalog_items ADD COLUMN download_links TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(download_links) AND json_type(download_links)='array');
UPDATE catalog_items SET download_links=json_array(json_object('id','legacy','label','外部下载','url',external_url,'extraction_code',extraction_code)) WHERE external_url<>'';
