package com.vectorcontrolhub.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.Inet4Address;
import java.net.InetAddress;

@CapacitorPlugin(name = "LocalNetwork")
public class LocalNetworkPlugin extends Plugin {
  @PluginMethod
  public void getNetworkSnapshot(PluginCall call) {
    JSObject result = new JSObject();
    JSArray addresses = new JSArray();
    result.put("supported", true);
    result.put("ready", false);
    result.put("transport", "unknown");
    result.put("note", "Connect this phone to the same Wi-Fi as your desktop backend first.");
    result.put("addresses", addresses);

    ConnectivityManager connectivityManager =
      (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);

    if (connectivityManager == null) {
      result.put("note", "Android connectivity services are unavailable on this device.");
      call.resolve(result);
      return;
    }

    Network activeNetwork = connectivityManager.getActiveNetwork();
    if (activeNetwork == null) {
      result.put("note", "No active network is connected yet.");
      call.resolve(result);
      return;
    }

    NetworkCapabilities capabilities = connectivityManager.getNetworkCapabilities(activeNetwork);
    LinkProperties linkProperties = connectivityManager.getLinkProperties(activeNetwork);
    String transport = resolveTransport(capabilities);

    result.put("transport", transport);

    if (linkProperties == null) {
      result.put("note", "Android could not read the active network details.");
      call.resolve(result);
      return;
    }

    int addressCount = 0;
    for (LinkAddress linkAddress : linkProperties.getLinkAddresses()) {
      InetAddress address = linkAddress.getAddress();
      if (!(address instanceof Inet4Address) || address.isLoopbackAddress()) {
        continue;
      }

      String hostAddress = address.getHostAddress();
      if (hostAddress == null || hostAddress.isBlank()) {
        continue;
      }

      JSObject entry = new JSObject();
      entry.put("address", hostAddress);
      entry.put("prefixLength", linkAddress.getPrefixLength());
      addresses.put(entry);
      addressCount += 1;
    }

    result.put("addresses", addresses);

    boolean localTransport =
      "wifi".equals(transport) ||
      "ethernet".equals(transport) ||
      "vpn".equals(transport) ||
      "other".equals(transport);

    boolean ready = addressCount > 0 && localTransport;
    result.put("ready", ready);

    if (ready) {
      result.put("note", "Ready to scan this local network for the desktop backend.");
    } else if (addressCount == 0) {
      result.put("note", "No local IPv4 address is active yet. Join the same Wi-Fi as your desktop backend.");
    } else if ("cellular".equals(transport)) {
      result.put("note", "The phone is on cellular data. Join the same Wi-Fi as your desktop backend first.");
    } else {
      result.put("note", "Connect this phone to the same local network as your desktop backend first.");
    }

    call.resolve(result);
  }

  private String resolveTransport(NetworkCapabilities capabilities) {
    if (capabilities == null) {
      return "unknown";
    }

    if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
      return "wifi";
    }

    if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) {
      return "ethernet";
    }

    if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
      return "cellular";
    }

    if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) {
      return "vpn";
    }

    return "other";
  }
}
